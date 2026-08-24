// CI gate: validate every overlay in data/overlays/ against its upstream
// entry. Exits non-zero on any error. Same validator the pipeline uses.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateOverlay } from "../lib/validate-overlay.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERLAYS = join(ROOT, "data", "overlays");
const APPS = join(ROOT, "data", "upstream", "apps");

let checked = 0;
let bad = 0;
for (const f of readdirSync(OVERLAYS).sort()) {
  if (!f.endsWith(".json")) continue;
  checked += 1;
  const overlay = JSON.parse(readFileSync(join(OVERLAYS, f), "utf8"));
  const entryPath = join(APPS, f);
  const entry = existsSync(entryPath)
    ? JSON.parse(readFileSync(entryPath, "utf8"))
    : null;
  const errors = validateOverlay(overlay, entry);
  if (!entry) errors.push("no matching upstream entry (orphaned overlay)");
  if (errors.length) {
    bad += 1;
    console.error(`✗ ${f}`);
    for (const e of errors) console.error(`    ${e}`);
  }
}

console.log(`${checked} overlays checked, ${bad} invalid`);
process.exit(bad ? 1 : 0);
