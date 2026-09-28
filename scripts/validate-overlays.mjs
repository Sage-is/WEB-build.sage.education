// CI gate: validate every overlay in data/overlays/ against its entry, which
// is either the upstream mirror or a first-party entry of our own. Exits
// non-zero on any error. Same validator the pipeline uses.
//
// A first-party entry is an exemption from "every overlay needs an upstream
// entry", and it pays for that exemption: it must itself pass
// validateFirstPartyEntry(), and it hands validateOverlay() a real entry, so
// slug match, moatTag membership and the step-count band all still fire.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateFirstPartyEntry,
  validateOverlay,
} from "../lib/validate-overlay.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERLAYS = join(ROOT, "data", "overlays");
const APPS = join(ROOT, "data", "upstream", "apps");
const FIRST_PARTY = join(ROOT, "data", "first-party");

let checked = 0;
let firstParty = 0;
let bad = 0;
for (const f of readdirSync(OVERLAYS).sort()) {
  if (!f.endsWith(".json")) continue;
  checked += 1;
  const overlay = JSON.parse(readFileSync(join(OVERLAYS, f), "utf8"));
  const firstPartyPath = join(FIRST_PARTY, f);
  const upstreamPath = join(APPS, f);
  const hasFirstParty = existsSync(firstPartyPath);
  const hasUpstream = existsSync(upstreamPath);
  const entry = hasFirstParty
    ? JSON.parse(readFileSync(firstPartyPath, "utf8"))
    : hasUpstream
      ? JSON.parse(readFileSync(upstreamPath, "utf8"))
      : null;
  const errors = validateOverlay(overlay, entry);
  if (hasFirstParty) {
    firstParty += 1;
    errors.push(...validateFirstPartyEntry(entry, f.replace(/\.json$/, "")));
    // make sync delete-then-writes data/upstream/apps/, so upstream could one
    // day ship this slug. Shadowing must be loud, not silent.
    if (hasUpstream)
      errors.push(
        "slug exists in both data/first-party/ and data/upstream/apps/; rename the first-party slug",
      );
  } else if (!entry) {
    errors.push(
      "no matching upstream entry (orphaned overlay); add data/first-party/<slug>.json if this lesson is ours",
    );
  }
  if (errors.length) {
    bad += 1;
    console.error(`✗ ${f}`);
    for (const e of errors) console.error(`    ${e}`);
  }
}

console.log(
  `${checked} overlays checked (${firstParty} first-party), ${bad} invalid`,
);
process.exit(bad ? 1 : 0);
