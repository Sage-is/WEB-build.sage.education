// Transform upstream entries into educational overlays.
// Mirrors upstream canivibecodeit's submissions.js shape: draft → validate →
// one retry with the validation errors fed back → write or record failure.
// Provenance fields (slug, sourceHash, generatedAt, generator, reviewStatus,
// timeEstimate) are set by this script, never trusted from the model.
//
// Usage: bun scripts/transform.mjs [--limit N] [--dry-run] [--force] [--slugs a,b,c]
// Route via LLM_ROUTE env: opencode (default) | claude-cli | openrouter
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { entryHash } from "../lib/hash.mjs";
import { resolveTimeEstimate } from "../lib/time.mjs";
import { validateOverlay } from "../lib/validate-overlay.mjs";

const PROMPT_VERSION = 1;
const CALL_TIMEOUT_MS = 300_000;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPS = join(ROOT, "data", "upstream", "apps");
const OVERLAYS = join(ROOT, "data", "overlays");
const SYSTEM_PROMPT = readFileSync(
  join(ROOT, "lib", "prompts", "transform-system.md"),
  "utf8",
);

const LEVEL_DEFAULT = { yes: "beginner", kinda: "intermediate", no: "advanced" };

// --- args + env ---------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const LIMIT = Number(opt("limit", 25));
const DRY = flag("dry-run");
const FORCE = flag("force");
const ROUTE = process.env.LLM_ROUTE || "opencode";
const MAX_RUN_USD = Number(process.env.MAX_RUN_USD || 1);
// Rough per-call ceiling for the metered route, mirroring upstream's ~$0.10/draft.
const EST_USD_PER_CALL = Number(process.env.EST_USD_PER_CALL || 0.1);

const MODELS = {
  opencode: process.env.OPENCODE_MODEL || "opencode/deepseek-v4-flash",
  "claude-cli": process.env.CLAUDE_CLI_MODEL || "claude-cli/default",
  openrouter: process.env.OPENROUTER_MODEL || "anthropic/claude-opus-5",
};
if (!(ROUTE in MODELS)) {
  console.error(`unknown LLM_ROUTE "${ROUTE}" (opencode|claude-cli|openrouter)`);
  process.exit(2);
}

// --- routes -------------------------------------------------------------
function callOpencode(prompt) {
  const model = MODELS.opencode;
  const res = spawnSync("opencode", ["run", "-m", model, prompt], {
    encoding: "utf8",
    timeout: CALL_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (res.status !== 0)
    throw new Error(`opencode exit ${res.status}: ${(res.stderr || "").slice(0, 400)}`);
  return { text: res.stdout, model };
}

function callClaudeCli(prompt) {
  const res = spawnSync("claude", ["-p", "--output-format", "json"], {
    input: prompt,
    encoding: "utf8",
    timeout: CALL_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (res.status !== 0)
    throw new Error(`claude exit ${res.status}: ${(res.stderr || "").slice(0, 400)}`);
  const wrapper = JSON.parse(res.stdout);
  return { text: wrapper.result ?? "", model: wrapper.model || "claude-cli" };
}

let meteredCalls = 0;
async function callOpenrouter(system, user) {
  meteredCalls += 1;
  if (meteredCalls * EST_USD_PER_CALL > MAX_RUN_USD)
    throw new Error(
      `MAX_RUN_USD ${MAX_RUN_USD} would be exceeded at call ${meteredCalls} (~$${EST_USD_PER_CALL}/call). Raise MAX_RUN_USD explicitly to continue.`,
    );
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  const model = MODELS.openrouter;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? "", model };
}

async function draft(system, user) {
  if (ROUTE === "openrouter") return callOpenrouter(system, user);
  const combined = `${system}\n\n---\n\n${user}`;
  return ROUTE === "claude-cli" ? callClaudeCli(combined) : callOpencode(combined);
}

// Tolerant JSON extraction: models sometimes fence or preface the object.
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

// --- main loop ----------------------------------------------------------
const pilot = JSON.parse(readFileSync(join(ROOT, "data", "pilot-slugs.json"), "utf8"));
const slugs = (opt("slugs", "") ? opt("slugs", "").split(",") : pilot.slugs).slice(0, LIMIT);

mkdirSync(OVERLAYS, { recursive: true });
const summary = { written: [], skipped: [], failed: [] };

for (const slug of slugs) {
  const entryPath = join(APPS, `${slug}.json`);
  if (!existsSync(entryPath)) {
    console.error(`✗ ${slug}: no upstream entry`);
    summary.failed.push(slug);
    continue;
  }
  const entry = JSON.parse(readFileSync(entryPath, "utf8"));
  const hash = entryHash(entry);
  const overlayPath = join(OVERLAYS, `${slug}.json`);
  const existing = existsSync(overlayPath)
    ? JSON.parse(readFileSync(overlayPath, "utf8"))
    : null;

  if (existing?.reviewStatus === "human" && !FORCE) {
    console.log(`- ${slug}: human-reviewed, skipping (use --force to regenerate)`);
    summary.skipped.push(slug);
    continue;
  }
  if (
    existing &&
    existing.sourceHash === hash &&
    existing.generator?.promptVersion === PROMPT_VERSION &&
    !FORCE
  ) {
    console.log(`- ${slug}: unchanged (hash + promptVersion match)`);
    summary.skipped.push(slug);
    continue;
  }
  if (DRY) {
    console.log(`~ ${slug}: would transform (${existing ? "stale" : "new"})`);
    summary.written.push(slug);
    continue;
  }

  const defaults = {
    level: LEVEL_DEFAULT[entry.verdict],
    timeEstimate: resolveTimeEstimate(entry.diyTimeEstimate),
  };
  const userMsg =
    `Default level: ${defaults.level}\nNormalized time estimate: ${defaults.timeEstimate}\n\nUpstream entry:\n` +
    JSON.stringify(entry, null, 2);

  let overlay = null;
  let lastErrors = [];
  let usedModel = MODELS[ROUTE];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const msg =
      attempt === 1
        ? userMsg
        : `${userMsg}\n\nYour previous attempt failed validation with these errors; fix them and return the full corrected JSON:\n- ${lastErrors.join("\n- ")}`;
    try {
      const { text, model } = await draft(SYSTEM_PROMPT, msg);
      usedModel = model;
      const drafted = extractJson(text);
      const merged = {
        slug,
        sourceHash: hash,
        generatedAt: new Date().toISOString(),
        generator: { model: usedModel, promptVersion: PROMPT_VERSION },
        reviewStatus: "auto",
        level: drafted.level,
        ...(drafted.levelReason ? { levelReason: drafted.levelReason } : {}),
        timeEstimate: defaults.timeEstimate,
        title: drafted.title,
        summary: drafted.summary,
        whatYoullLearn: drafted.whatYoullLearn,
        whatYouWontGet: drafted.whatYouWontGet,
        moatLessons: drafted.moatLessons,
        prerequisites: drafted.prerequisites,
        steps: drafted.steps,
        ...(drafted.stretchGoals?.length ? { stretchGoals: drafted.stretchGoals } : {}),
        resources: drafted.resources ?? [],
      };
      lastErrors = validateOverlay(merged, entry);
      if (lastErrors.length === 0) {
        overlay = merged;
        break;
      }
      console.error(`  ${slug} attempt ${attempt}: ${lastErrors.length} validation errors`);
    } catch (e) {
      lastErrors = [String(e.message || e)];
      console.error(`  ${slug} attempt ${attempt}: ${lastErrors[0].slice(0, 200)}`);
    }
  }

  if (overlay) {
    writeFileSync(overlayPath, JSON.stringify(overlay, null, 2) + "\n");
    console.log(`✓ ${slug}: overlay written (${overlay.steps.length} steps, ${overlay.level})`);
    summary.written.push(slug);
  } else {
    console.error(`✗ ${slug}: failed after retry — ${lastErrors.slice(0, 3).join(" | ")}`);
    summary.failed.push(slug);
  }
}

console.log(
  `\ndone. written: ${summary.written.length}, skipped: ${summary.skipped.length}, failed: ${summary.failed.length}` +
    (summary.failed.length ? `\nfailed: ${summary.failed.join(", ")}` : ""),
);
if (summary.failed.length) process.exit(1);
