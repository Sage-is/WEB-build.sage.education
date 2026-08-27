// Fetch each lesson's source-site favicon into src/assets/icons/<slug>.png.
// Uses Google's s2 favicon endpoint (returns a PNG at the requested size,
// handles the ico/link-rel/fallback mess for us). Icons are committed, so
// the Pages build never touches the network. Idempotent: skips slugs whose
// icon already exists unless --force is passed.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERLAYS = join(ROOT, "data", "overlays");
const APPS = join(ROOT, "data", "upstream", "apps");
const DEST = join(ROOT, "src", "assets", "icons");
const FORCE = process.argv.includes("--force");
const SIZE = 128;

// Google serves a 16px globe placeholder when it has no icon for a domain.
// Those tiny bodies are worthless — treat them as a miss.
const PLACEHOLDER_MAX_BYTES = 600;

mkdirSync(DEST, { recursive: true });

let fetched = 0;
let skipped = 0;
const misses = [];

for (const f of readdirSync(OVERLAYS).sort()) {
  if (!f.endsWith(".json")) continue;
  const slug = f.replace(/\.json$/, "");
  const out = join(DEST, `${slug}.png`);
  if (existsSync(out) && !FORCE) {
    skipped++;
    continue;
  }
  const entryPath = join(APPS, f);
  if (!existsSync(entryPath)) {
    misses.push(`${slug} (no upstream entry)`);
    continue;
  }
  const { domain } = JSON.parse(
    await import("node:fs/promises").then((m) => m.readFile(entryPath, "utf8")),
  );
  if (!domain) {
    misses.push(`${slug} (no domain)`);
    continue;
  }
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=${SIZE}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length <= PLACEHOLDER_MAX_BYTES)
      throw new Error(`placeholder-sized body (${buf.length}B)`);
    writeFileSync(out, buf);
    fetched++;
    console.log(`✓ ${slug} ← ${domain} (${buf.length}B)`);
  } catch (err) {
    misses.push(`${slug} (${domain}: ${err.message})`);
  }
}

console.log(`\n${fetched} fetched, ${skipped} already present`);
if (misses.length) {
  console.log(`misses:\n  ${misses.join("\n  ")}`);
  process.exitCode = 1;
}
