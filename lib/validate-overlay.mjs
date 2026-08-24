// One validator shared by the transform pipeline and CI, mirroring upstream
// canivibecodeit's validate-app.js pattern: validateOverlay() returns an array
// of error strings; empty array means valid.
import { TIME_ENUM } from "./time.mjs";

export const LEVELS = ["beginner", "intermediate", "advanced"];
export const LABELS = ["WE", "MANUALLY", "DELEGATE"];
export const REVIEW_STATUSES = ["auto", "human"];

// Step-count band per upstream verdict: one-shottable stays short, capstones
// go deep.
export const STEP_BANDS = { yes: [1, 3], kinda: [3, 6], no: [5, 8] };

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isArr = Array.isArray;

export function validateOverlay(overlay, upstreamEntry) {
  const errors = [];
  const err = (m) => errors.push(m);

  if (!overlay || typeof overlay !== "object" || isArr(overlay)) {
    return ["overlay is not an object"];
  }

  // Identity + provenance
  if (!isStr(overlay.slug)) err("slug: required non-empty string");
  else if (upstreamEntry && overlay.slug !== upstreamEntry.slug)
    err(`slug: "${overlay.slug}" does not match upstream "${upstreamEntry.slug}"`);
  if (!/^sha256:[0-9a-f]{64}$/.test(overlay.sourceHash ?? ""))
    err("sourceHash: must be sha256:<64 hex chars>");
  if (!isStr(overlay.generatedAt) || Number.isNaN(Date.parse(overlay.generatedAt)))
    err("generatedAt: must be an ISO date string");
  if (!overlay.generator || !isStr(overlay.generator.model))
    err("generator.model: required non-empty string");
  if (!Number.isInteger(overlay.generator?.promptVersion))
    err("generator.promptVersion: required integer");
  if (!REVIEW_STATUSES.includes(overlay.reviewStatus))
    err(`reviewStatus: must be one of ${REVIEW_STATUSES.join("|")}`);

  // Leveling
  if (!LEVELS.includes(overlay.level))
    err(`level: must be one of ${LEVELS.join("|")}`);
  if (overlay.levelReason != null && !isStr(overlay.levelReason))
    err("levelReason: must be a non-empty string when present");
  if (!TIME_ENUM.includes(overlay.timeEstimate))
    err(`timeEstimate: must be one of ${TIME_ENUM.join("|")}`);

  // Educational rewrites
  if (!isStr(overlay.title)) err("title: required non-empty string");
  if (!isStr(overlay.summary)) err("summary: required non-empty string");
  if (!isArr(overlay.whatYoullLearn) || overlay.whatYoullLearn.length < 3 || overlay.whatYoullLearn.length > 5)
    err("whatYoullLearn: must be an array of 3-5 items");
  else if (!overlay.whatYoullLearn.every(isStr))
    err("whatYoullLearn: every item must be a non-empty string");
  if (!isArr(overlay.whatYouWontGet) || overlay.whatYouWontGet.length < 1)
    err("whatYouWontGet: must be a non-empty array");
  else if (!overlay.whatYouWontGet.every(isStr))
    err("whatYouWontGet: every item must be a non-empty string");
  if (!isArr(overlay.prerequisites)) err("prerequisites: must be an array");
  else if (!overlay.prerequisites.every(isStr))
    err("prerequisites: every item must be a non-empty string");

  // Moat lessons: each tag must exist on the upstream entry.
  if (!isArr(overlay.moatLessons)) err("moatLessons: must be an array");
  else {
    for (const [i, m] of overlay.moatLessons.entries()) {
      if (!m || !isStr(m.tag) || !isStr(m.lesson)) {
        err(`moatLessons[${i}]: needs {tag, lesson} non-empty strings`);
        continue;
      }
      if (upstreamEntry && !(upstreamEntry.moatTags ?? []).includes(m.tag))
        err(`moatLessons[${i}].tag: "${m.tag}" is not in the upstream entry's moatTags`);
    }
  }

  // Steps — the core of the lesson.
  if (!isArr(overlay.steps) || overlay.steps.length === 0) {
    err("steps: must be a non-empty array");
  } else {
    const band = upstreamEntry ? STEP_BANDS[upstreamEntry.verdict] : null;
    if (band && (overlay.steps.length < band[0] || overlay.steps.length > band[1]))
      err(
        `steps: verdict "${upstreamEntry.verdict}" needs ${band[0]}-${band[1]} steps, got ${overlay.steps.length}`,
      );
    for (const [i, s] of overlay.steps.entries()) {
      const at = `steps[${i}]`;
      if (!s || typeof s !== "object") {
        err(`${at}: must be an object`);
        continue;
      }
      if (!LABELS.includes(s.label))
        err(`${at}.label: must be one of ${LABELS.join("|")}`);
      if (!isStr(s.title)) err(`${at}.title: required non-empty string`);
      if (!isStr(s.body)) err(`${at}.body: required non-empty string`);
      if (!isStr(s.why)) err(`${at}.why: required one-line non-empty string`);
      if (s.label === "MANUALLY") {
        if (s.prompt != null)
          err(`${at}.prompt: must be null on MANUALLY steps (humans click, agents don't)`);
      } else if (s.prompt != null) {
        if (!isStr(s.prompt)) err(`${at}.prompt: must be a non-empty string or null`);
        else {
          const lines = s.prompt.split("\n").length;
          if (!s.prompt.includes("Requirements:"))
            err(`${at}.prompt: must follow the style guide shape (missing "Requirements:")`);
          if (lines < 4 || lines > 34)
            err(`${at}.prompt: ${lines} lines; step prompts should be 4-34 lines`);
          if (s.prompt.includes("—"))
            err(`${at}.prompt: no em dashes in prompts (style guide); use commas or " · "`);
        }
      }
    }
  }

  // Optional extras
  if (overlay.stretchGoals != null) {
    if (!isArr(overlay.stretchGoals) || overlay.stretchGoals.length > 3)
      err("stretchGoals: must be an array of at most 3 items when present");
    else if (!overlay.stretchGoals.every(isStr))
      err("stretchGoals: every item must be a non-empty string");
  }
  if (!isArr(overlay.resources)) err("resources: must be an array");
  else {
    for (const [i, r] of overlay.resources.entries()) {
      if (!r || !isStr(r.title) || !isStr(r.url))
        err(`resources[${i}]: needs {title, url} non-empty strings`);
      else if (!/^https?:\/\//.test(r.url))
        err(`resources[${i}].url: must be http(s)`);
      if (r && r.note != null && !isStr(r.note))
        err(`resources[${i}].note: must be a non-empty string when present`);
    }
  }

  return errors;
}
