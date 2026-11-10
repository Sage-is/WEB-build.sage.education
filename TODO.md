# build.sage.education TODOs

- One claim per card: the bold line is the claim, nested checkboxes carry the detail.
- Urgency is an inline `#critical` tag, never a section.

> **Convention**: sections below map to kanban columns. Inline source tags use the same vocabulary, so items stay cross-referenced between this file and the code. `.todoscope-exclude.csv` lists the paths the scanner skips.
>
> | Column      | Markdown section          | Inline tag |
> |-------------|---------------------------|------------|
> | Backlog     | `## Backlog`              |            |
> | TODO        | `## TODO`                 | `# TODO:`  |
> | In Progress | `## In Progress`          | `# FIXME:` |
> | Bugs        | `## Bugs`                 | `# BUG:`   |
> | Done        | `- [x]` items / `## Done` |            |
>
> Track `# DEPRECATED:` tags as TODO items for removal at the stated version.

## In Progress

- [ ] **Gamify progress locally and share it with LLR/1**: steps, stretch goals, time goals, badges and self-reported certificates live in the learner's browser; LLR/1 moves summaries between our sites by navigation (n8n "your servers" pattern). Plan: `~/.claude/plans/polymorphic-rolling-breeze.md`.
  - [x] `src/assets/progress-core.js` + `test/progress-core.test.js`: state, migration from `sage-build-progress`, merge, sticky awards, goals, xAPI and OB3 views. shipped 2026-10-27
  - [x] `src/assets/llr.js` + `test/llr.test.js`: fragment payload, referrer and registry check, snapshots, widget, "your Sage servers". shipped 2026-10-27
  - [x] Lesson page, `/progress/`, `/certificate/` (1920s frame), `/llr/export/`, `/catalog.json`, `/achievements/<id>.json`, `src/_headers` CORS for `/llr/v1/*`. shipped 2026-10-27
  - [x] Startr Swap v1.1 vendored (sha256 `8a4f07ee…`); `<main data-swap>`; delegated `progress.js` and `pb-capture.js`. shipped 2026-10-27
  - [x] Design pass: chips 5.1:1 or better on white, one card recipe in `src/_data/ui.js`, one phone gutter, title card, `[hidden]` fix. shipped 2026-10-27
  - [x] `docs/llr-1.md` spec. shipped 2026-10-27
  - [x] Verify: 29 bun tests, `make validate`, `make build`, Chrome on :8080/:8081/:8082, headless print to one page on A4 and Letter, no overflow at 390px. 2026-10-27
  - [x] Print in Safari on A4 and Letter: one page, 28mm top gap, `zoom: 0.9375` undoes WebKit's 0.8pt px. Safari cannot tell A4 from Letter, so A4 sits a little high (accepted). 2026-10-28
  - [ ] Widget push and pull in Safari and Firefox on the deployed hosts.
  - [x] POST an export to Yet Analytics SQL LRS v0.9.11 in Docker (SQLite): a resend stores nothing (`200 []`); actor hard-delete leaves 0. 2026-10-28
    - [x] Found and fixed: a later export (goal moved, step unticked) got `409 Statement Conflict` and lost the whole batch. Statements now carry event-time facts only: a `set-goal` statement, no progress %, a frozen `completion`. Rerun: 9 of 9 stored. 2026-10-28
  - [x] Commit and push to `develop` (`f9ef18f`); the live site serves `/progress/`, `/catalog.json`, `/certificate/` and `/llr/v1/llr.js`. seen 2026-11-01
  - [ ] Cut a release to `master`: `origin/master` (`77b0e25`) is 26 commits behind `develop`, yet production already serves this work; `make deploy` uploads the local `dist` with wrangler, so `develop` reached production without a release (seen 2026-11-10).

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
  - [ ] Until then, keep first-party slugs out of it: `scripts/transform.mjs` hard-fails a slug with no upstream entry, and first-party lessons are written by hand.

- [ ] **Stop silent drift into production**: three gaps let a change ship with no failing check or no commit here.
  - [ ] Make `make favicons` set a non-zero exit on any miss: hand-drawn first-party icons count as misses too, so a gap cannot pass CI.
  - [ ] Version the startr.style stylesheet in `src/_includes/component/head.njk`: the unversioned CDN link lets upstream changes reach production with no commit here.
  - [ ] `data/upstream` is not verbatim: e531270, e91c7d7 and d6e112f edited 19 files; `NOTICE.md:5` says verbatim and `make sync` would revert them; move the wording into `data/overlays/` or change NOTICE (found 2026-10-06).

- [ ] **Align the repo with TodoScope**: the board should read this file and the source cleanly.
  - [x] Restructure this file to the convention: strays grouped under parent cards, the swap-favicon defect moved to Bugs. 2026-11-02
  - [x] Add `.todoscope-exclude.csv` (`node_modules`, `dist`, `data/upstream`, `src/assets/startr-swap.js`, `.delegate`) and re-include it in `.gitignore`. 2026-11-02
  - [ ] Scan the repo in TodoScope and check that the columns match this file.
  - [ ] Migrate any inline work tags outside `TODO:`, `FIXME:` and `BUG:` that the scan lists.

## Backlog

- [ ] **Decide whether Sage Trellis (the CRM) earns its own lesson**: the advanced band ceiling is 8 steps, so the scope has to fit that ceiling or ship as something else.
- [ ] **Offer canivibecodeit a courtesy priorArt PR**: point at our repos, and treat it as a courtesy that must never gate our own publishing.
- [ ] **Carry LLR/1 beyond this site**: each step adds a destination without changing the protocol.
  - [ ] Classroom page on `sage.education`: a full-size LLR widget over every registered site's snapshot, with "Refresh from …" pull buttons.
  - [ ] Central hub for learning records: pick one permanent origin first, because moving it strands stored data; a single origin with sites as paths is the only setup silent in every browser.
  - [ ] Adopt LLR/1 on `sage.education` lessons and `docs.sage.education`: load `/llr/v1/llr.js`, add `data-llr` links and a `data-llr-widget`.
  - [ ] Sage AI-UI `/learn/import`: the server side of "your Sage servers"; login, preview, save on click, lesson content fetched from `/catalog.json`.
  - [ ] Optional live LLR reader: an iframe reader, silent in Chrome and Firefox same-site; Safari partitions per origin, so it can never be the only path.
- [ ] **Backend sync and signed credentials**: Yet Analytics SQL LRS (Apache-2.0, SQLite mode, one container on CapRover) behind a thin relay in Django, PocketBase or Sage AI-UI; no blockchain, no IPFS (research 2026-10-28).
  - [ ] Relay: a static site cannot hold LRS credentials. It keeps the key, rate-limits and forwards; unique index on statement id; read any 409 as stored, then resend that batch one statement at a time
  - [ ] SQL LRS: `LRSQL_ENABLE_ADMIN_DELETE_ACTOR=true` for erasure (`DELETE /admin/agents`, IFI `account::<uuid>@https://build.sage.education`); back up the SQLite file; amd64 image only, about 500 MiB idle under emulation
  - [ ] "Delete my records" button: the browser holds its own UUID and sends it; link per-site UUIDs into one Person only when the learner opts in
  - [ ] Sign OB3: `did:web` on sage.education, Ed25519 key in the vault via `sage-secret`, eddsa-rdfc-2022 or VC-JWT; revoke through a Bitstring Status List we host; bundle as CLR 2.0
  - [ ] Ruled out: Ralph (needs Elasticsearch, Mongo or ClickHouse), TRAX Starter (erasure is paid-only), ADL LRS (proof of concept), Learning Locker OSS (no commit since 2021-11), public chains and IPFS (EDPB 02/2025: keep personal data off-chain)
- [ ] **Certificate share image**: a PNG from canvas, offered beside the printable page.
- [ ] **Set `PB_URL` in the production build**: the live site still says "Signups open when the site goes live" (seen 2026-10-27).

## Bugs

- [ ] **Per-lesson favicon does not update after a swap**: Startr Swap replaces `main` only. #bug

## Done

*Completed cards move here with the date they shipped.*
