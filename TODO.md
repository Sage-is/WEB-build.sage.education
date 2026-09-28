# build.sage.education TODOs

- One claim per card: the bold line is the claim, nested checkboxes carry the detail.
- Inline source tags set the column: `# FIXME:` to In Progress, `# TODO:` to TODO, `# BUG:` to Bugs.
- Urgency is an inline `#critical` tag, never a section.

## In Progress

- [ ] **Ship our first first-party lesson**: first-party lessons let us teach projects we build ourselves, which have no upstream canivibecodeit entry.
  - [x] `data/first-party/<slug>.json` entry-shaped so `validateOverlay` keeps slug match, moatTag membership and step-count band armed with no rule relaxed. shipped 2026-09-28
  - [x] `src/_data/lessons.js` resolving the entry from `data/first-party/` first and `data/upstream/apps/` as fallback. shipped 2026-09-28
  - [x] `lib/validate-overlay.mjs` gaining `validateFirstPartyEntry()` only. shipped 2026-09-28
  - [x] `scripts/validate-overlays.mjs` keeping the orphan error plus a new both-directories slug-collision error, because `make sync` replaces the upstream mirror wholesale. shipped 2026-09-28
  - [x] `scripts/fetch-favicons.mjs` skipping first-party slugs with an actionable message. shipped 2026-09-28
  - [x] `src/_includes/lesson.njk` branching the About block on `e.priceMonthly` and crediting canivibecodeit when an upstream entry exists. shipped 2026-09-28
  - [x] Hand-write `data/overlays/sage-practice.json` with `reviewStatus` human, advanced level, 7 steps, and `sourceHash` from `entryHash()` of the first-party entry. shipped 2026-09-28
  - [x] Draw `src/assets/icons/sage-practice.svg` and rasterize to a 128x128 PNG, then commit both. shipped 2026-09-28
  - [x] Verify: validator reports `23 overlays checked (1 first-party), 0 invalid`; build renders 7 steps, 6 copyable prompts, no price block; `plausible` keeps its price block and MIT credit. shipped 2026-09-28
  - [ ] Editorial pass on the lesson prose by a second reader, then commit and deploy.
  - [ ] Decide the real product name before the repo is created; the entry says Sage Practice and the slug `sage-practice` is easiest to change now.

## TODO

- [ ] **Retire `data/pilot-slugs.json` once the lesson format settles**: the pilot gate should fall away so `make transform` covers the full upstream set.
- [ ] **Keep first-party slugs out of `data/pilot-slugs.json`**: `scripts/transform.mjs` hard-fails a slug with no upstream entry, and first-party lessons are written by hand.
- [ ] **Make `make favicons` set a non-zero exit on any miss**: hand-drawn first-party icons count as misses too, so a gap cannot pass CI.
- [ ] **Version the startr.style stylesheet in `src/_includes/component/head.njk`**: the unversioned CDN link lets upstream changes reach production with no commit here.

## Backlog

- [ ] **Decide whether Sage Trellis (the CRM) earns its own lesson**: the advanced band ceiling is 8 steps, so the scope has to fit that ceiling or ship as something else.
- [ ] **Offer canivibecodeit a courtesy priorArt PR**: point at our repos, and treat it as a courtesy that must never gate our own publishing.

## Bugs

*No bugs tracked yet. Tag one in source with `# BUG:` and it lands in this column.*

## Done

*Completed cards move here with the date they shipped.*
