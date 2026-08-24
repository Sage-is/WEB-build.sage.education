# Lesson style guide · build.sage.education

Rules for lesson content and step prompts. Derived from upstream
canivibecodeit's `scripts/prompt-style-guide.md`, adapted from one-shot
delivery to teaching. The validator (`lib/validate-overlay.mjs`) enforces the
mechanical rules; this file holds the judgment ones.

## Register

- Educational and encouraging, but honest. Never promise the paid product;
  say plainly what the build covers and what it does not.
- Explain a technical term the first time it appears ("SQLite, a single-file
  database"). After that, use it plainly.
- No snark, no marketing words. Banned: seamless, powerful, beautiful,
  delightful, robust, blazing, intuitive, production-ready.
- Short sentences. One idea per sentence. No em dashes in step prompts; use
  commas or " · ".

## Step labels — teach delegation judgment

Every step gets exactly one label and a one-line `why` explaining the label.
The labels are the curriculum: learners practice deciding what to do by hand,
what to steer, and what to hand off.

- **MANUALLY** — human-only surfaces: dashboards, OAuth consoles, DNS, app
  store accounts, payment settings, physical permissions. No prompt on these
  steps; no agent can click them for you. The why-line names the surface.
- **WE** — the learner drives an AI assistant step by step: CLI work, file
  edits, debugging. A prompt is provided; the learner reviews each action and
  stays in the loop. Use WE when the step teaches something worth watching.
- **DELEGATE** — a well-specified, low-risk chunk handed to an agent in one
  go: boilerplate, scaffolding, mechanical conversions. A prompt is provided.
  Use DELEGATE only when the spec is precise enough that reviewing the result
  is cheaper than watching the work.

## Step prompts (WE and DELEGATE steps)

Same bones as upstream's one-shot guide, scoped to one step:

1. Opening line: `Build/Add/Set up <specific thing>. Requirements:` then
   4-8 flat `- ` bullets. 4-34 lines total.
2. One opinionated stack, real library names, never categories.
3. Storage named concretely (driver or path). Secrets in .env.
4. Every bullet verifiable: paths, formats, counts, field lists.
5. 1-2 out-of-scope items when an agent would otherwise gold-plate.
6. Honest pain warnings inline ("budget an hour for the Google Cloud
   console alone").
7. Prompts must build on the artifacts of earlier steps by name, so the
   lesson chains instead of restarting.

## Lesson prose fields

- `summary` — 2-4 sentences: what you will build, and why the paid product
  still survives (the moat, in plain words).
- `whatYoullLearn` — 3-5 concrete skills ("SQLite full-text search with
  FTS5"), not vibes ("databases").
- `whatYouWontGet` — honest scope-setting, phrased as facts, not apologies.
- `moatLessons` — one short lesson per upstream moat tag: why the company
  wins there, and what a builder learns from that.
- `prerequisites` — concrete: tools installed, accounts needed, prior
  lessons.
- `resources` — real URLs only, taken from the upstream entry or added by a
  human editor. An invented link is worse than no link.
