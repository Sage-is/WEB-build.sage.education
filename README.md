# build.sage.education

## Learn to build your own software, one project at a time. 

A [Sage.Education](https://sage.education) projects that builds on the [canivibecodeit](https://canivibecodeit.com) dataset. Providing leveled, multi-step lessons: what to do **BY HAND**, what to build **WE**-style with an assistant in the loop, and what to **DELEGATE** to an agent outright.

## How it works

- `make sync` — pulls upstream `data/apps/*.json` (tarball, no clone) into
  `data/upstream/` verbatim. Upstream is a pure feed; we never edit it.
- `make transform` — turns entries into educational overlays in
  `data/overlays/`, one JSON per slug, keyed by a content hash so only
  changed entries reprocess. Route via `LLM_ROUTE` (see `.env.example`).
  Draft → validate → one retry with errors fed back.
- `make validate` — CI gate; same validator the pipeline uses
  (`lib/validate-overlay.mjs`).
- `make it_run` / `make build` — 11ty + [startr.style](https://startr.style),
  static output in `dist/`. Lessons render only for slugs with a valid
  overlay.
- `make deploy` — Cloudflare Pages via wrangler.

Levels map from upstream verdicts: yes → beginner (one-sitting wins), kinda → intermediate (weekend builds), no → advanced (capstones that teach why moats exists).

## Licensing

Code and lessons are AGPL-3.0 (`LICENSE`). Upstream data is MIT by Rob Hallam & contributors — see `NOTICE.md` for full attribution.
