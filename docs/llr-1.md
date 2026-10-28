# LLR/1: Local Learning Record

## 1. Purpose

LLR/1 moves a learning record between sites only when the learner navigates. Progress stays in each site's own browser storage. No central account or background sync moves it.

The design follows n8n's “your servers” model: a destination announces itself by link, and every handoff uses a top-level navigation. The browser therefore opens the destination as the top-level origin.

LLR/1 does not use iframes. Safari partitions storage by top-level origin (WebKit bug 247565), so an iframe cannot reliably access the site's own storage. Related Website Sets are retired. A parent-domain cookie would ride every request header.

## 2. Storage keys

| Key | Stored data |
| --- | --- |
| `sage-build` | The site's local progress state: `schema`, `learner` (`name`, `uuid`), `lessons`, and `awards`. Lesson data includes step ticks, dates, goals, evidence URLs, and reflections. |
| `llr-snapshots` | Accepted incoming summaries, keyed by source origin. Each value contains `name`, `at`, `receivedAt`, and `summary`. |
| `sage-servers` | Servers the learner confirmed, with `base`, `caps`, and `addedAt`. |

## 3. Wire format and size caps

LLR/1 serializes a JSON envelope, compresses it with `deflate-raw`, then encodes it as unpadded base64url. The fragment value starts with `1.`. A handoff URL uses `#llr=1.<payload>`. The fragment does not reach the server.

The envelope fields are `llr`, `src`, `kind`, `at`, and `body`. `llr` is `1`. `src` is the source origin. `at` is an ISO date string. `kind` is `summary` for a site-to-site snapshot or `statements` for a send to a Sage server. A summary's body is the summary object. A statements body's shape is `{ "statements": [...] }`.

The decoder accepts only strings of at most 65,536 characters matching `1.` followed by base64url characters. It rejects malformed compression, invalid JSON, and decoded JSON larger than 262,144 bytes.

## 4. Summary fields

A summary has `courses` and `awards` arrays. A course includes the following fields:

| Field | Meaning |
| --- | --- |
| `id` | Lesson IRI. |
| `title` | Lesson title. |
| `url` | Lesson page URL. |
| `done`, `total` | Completed and total steps. |
| `resumeUrl` | Lesson URL with the next step fragment, or the lesson URL when no step remains. |
| `startedAt`, `lastProgressAt` | Start and latest progress dates. |
| `dueAt`, `completedAt` | Goal date and completion date. |
| `withinGoal` | Whether completion met the goal, or `null`. |

An award has `id` (achievement IRI), `name`, and `awardedAt`.

The receiver keeps only these fields. It accepts at most 100 courses and 200 awards. Course and award IDs are limited to 500 characters, titles and award names to 200 characters. Counts must be integers from 0 through 100. Dates are normalized to ISO strings. Course `url` and `resumeUrl` must be HTTP(S) URLs on the source origin; an invalid `resumeUrl` falls back to `url`. An award needs an HTTP(S) IRI and a valid `awardedAt`.

## 5. Acceptance rules

A summary is accepted only when all of these conditions hold:

- `llr` is `1` and `kind` is `summary`.
- `src` exactly matches a registered site origin and is not this page's origin.
- The browser's `document.referrer` has the same origin as `src`.
- `at` is a valid date.

The browser captures the referrer before stripping the fragment, then validates it during receipt. A `#llr=` added by a same-document `hashchange` has no trustworthy source. The page removes that fragment with `history.replaceState` and ignores it.

The destination registry is JSON in a script with `id="llr-registry"`. It has a `sites` array. Each site has `origin`, `name`, `receives`, and `exports`. The origin and name identify the site. Set `receives` to `true` only when it runs LLR/1 and the head snippet; outgoing links carry summaries only to registered sites with `receives: true`. Set `exports` to `true` only when it serves `/llr/export/`; pull links appear only for registered sites with `exports: true`.

Sources must not send `Referrer-Policy: no-referrer` or `Referrer-Policy: same-origin`. The receiver needs the cross-origin referrer origin to validate the sender.

## 6. Push, pull, and Sage servers

**Push.** A link to another registered site can use `data-llr`. On click or auxiliary click, LLR/1 decorates it with the source's prepared summary in `#llr=` only if the destination is registered, has `receives: true`, and is not the current origin. The actual handoff is the link's top-level navigation.

**Pull.** A site with `exports: true` serves `/llr/export/`. A registered site's pull link goes to `/llr/export/?return=<encoded return URL>`. The export page accepts a return URL only when its origin is registered or matches a learner-confirmed Sage server. It then navigates back to that URL with a summary in `#llr=`. Otherwise it sends nothing and reports that the return address is not allowed.

**Sage servers.** A Sage server announces itself through a Learn link with `?sage_server=<base URL>&sage_caps=<comma-separated caps>`. The inline head snippet lifts those query parameters and the `#llr=` fragment off the address bar before other page code runs. The server base must be HTTP(S). Its origin and path are retained, with a trailing slash. Capability names are trimmed, restricted to lowercase letters, digits, and hyphens, limited to 40 characters each, and capped at 20 entries.

LLR/1 presents an in-page confirmation. The learner can choose Add or Ignore. Add stores the server in `sage-servers`; the page shows each saved base and its capabilities, with a Remove button. Only a server whose caps include `llr-import` gets a send button. The learner's click sends statements in a `#llr=` fragment to `<base>learn/import`. The handoff is a top-level navigation.

## 7. Records

The local progress core can produce xAPI 2.0 statements. The actor is an anonymous `Agent` with `account.homePage` set to the site's canonical URL and `account.name` set to the learner UUID. It does not use the learner's name.

The statement verbs are:

| Event | Verb IRI |
| --- | --- |
| Attempted a lesson | `http://adlnet.gov/expapi/verbs/attempted` |
| Set a goal for a lesson | `<site.url>/xapi/verbs/set-goal` |
| Progressed on a step | `http://adlnet.gov/expapi/verbs/progressed` |
| Completed a lesson | `http://adlnet.gov/expapi/verbs/completed` |
| Earned an achievement | `http://id.tincanapi.com/verb/earned` |

Lesson activities use `http://adlnet.gov/expapi/activities/lesson`. Lesson IRIs are `<site.url>/lessons/<slug>/`; step IRIs append `#step-<index>`. Path parent IRIs are `<site.url>/paths/<level>/`. Step activities use `<site.url>/xapi/activity-types/step`. Goal statements use the context extensions `<site.url>/xapi/extensions/goal-due` (the goal date) and `<site.url>/xapi/extensions/goal-by` (`estimate` or `learner`). Completion step-mode counts use the result extension `<site.url>/xapi/extensions/step-modes`.

A lesson start yields an `attempted` statement. Each goal yields a `set goal` statement dated when the goal was set; a changed goal is a new statement. Each tick yields a `progressed` statement, ordered by tick date, that names its step in `contextActivities.other` and carries no result. Completion yields a `completed` statement with `completion: true`, step-mode counts for `WE`, `MANUALLY`, and `DELEGATE`, and duration when there is a start date. The counts and duration are frozen in the lesson's `completion` record at the moment of completion. Awards yield `earned` statements whose activity IRI is `<site.url>/achievements/<id>.json`.

**Statements never change.** An LRS that receives a known statement ID with different content answers `409 Conflict`, and refuses the whole batch with it. So a statement carries only what was true when its event happened. It never carries a running value, such as a progress percentage or the current goal. Some LRSs answer `409` even to an identical resend; because our statements never change, a sender can read any `409` as "already stored". The `409` still refused the rest of the batch, so the sender then sends that batch one statement at a time. The check: send an export to an LRS, change the goal, untick and re-tick a step, finish, then send again; the second send must succeed (SQL LRS v0.9.11, 2026-10-28).

Statement IDs are deterministic UUIDv8 values. The core hashes the UTF-8 encoding of the identity parts joined by `|` with SHA-256, takes the first 16 bytes, sets the UUID version and variant bits, and formats the result as a UUID. Identity parts are the actor account name, verb IRI, and event-specific IRI and date. A resend of the same event therefore has the same ID.

Achievement definitions are Open Badges 3.0 `Achievement` JSON at `/achievements/<id>.json`. They use the W3C credentials v2 and OB v3.0.3 contexts and have `id`, `type`, `achievementType`, `name`, `description`, `criteria`, and `creator`. These are definitions, not credentials, and are unsigned. Exported claims are also unsigned. Each claim has `achievement`, `awardedAt`, and `evidence`; lesson claims cite tick step IRIs and include an evidence URL when present.

`/catalog.json` publishes `llr: 1`, `site`, `name`, `lessons`, and `achievements`. A lesson entry has `id`, `slug`, `title`, `summary`, `level`, `timeEstimate`, `goalDays`, `sourceHash`, `steps`, `stretchGoals`, and `achievement`. Each step has `id`, `title`, and `label`. The `achievements` list contains achievement IDs.

## 8. Adopting LLR/1 on another site

Use the receiver fixture as the minimum implementation checklist:

1. Put the inline head snippet first in `<head>`, before other page code. It captures `#llr=` and its referrer, captures `sage_server` and `sage_caps`, deletes those parameters, and calls `history.replaceState` to clean the address bar.
2. Add a JSON `application/json` script with `id="llr-registry"` and the registered sites. Set each site's `receives` and `exports` flags accurately.
3. Load `llr.js` with `defer`, from `https://build.sage.education/llr/v1/llr.js` with `integrity` and `crossorigin="anonymous"`. build serves `/llr/v1/*` with `Access-Control-Allow-Origin: *` (`src/_headers`), which SRI on a cross-origin script requires.
4. Add a `[data-llr-widget]` element to display accepted snapshots. Add links to registered sites with `data-llr` when they should carry a summary.
5. If the site keeps progress of its own, describe it with `SageLLR.provide({ summary, statements })` before `DOMContentLoaded`. `summary()` returns the summary object; `statements(slug)` returns xAPI statements, or a promise of them. Without a provider the page still receives and shows other sites' snapshots.
6. Serve the page as a top-level page. For local testing, the fixture uses `http://localhost:8081` and loads the script from `http://localhost:8080/llr/v1/llr.js`; run build with `LLR_DEV=1` so its registry lists the local origins.

To calculate the script's Subresource Integrity value:

```sh
openssl dgst -sha384 -binary dist/llr/v1/llr.js | openssl base64 -A
```

## 9. Privacy

The summary carries lesson titles, counts, and dates, plus award IDs, names, and dates. A summary never carries the learner's name, project links, or reflections. The statement actor is anonymous and uses the learner UUID as its account name. Render received data with `textContent` only; do not interpret it as HTML.

The backup file from `/progress/` is different: it holds the full state, name and reflections included, and it goes only where the learner saves it. Import treats it as untrusted, checks it against the schema, and merges it.

## 10. Roadmap

The roadmap is a classroom page on `sage.education`, a central hub on one permanent origin, and backend sync to a Yet Analytics SQL LRS with signed Open Badges 3.0 and CLR 2.0.

Each step adds a destination and leaves this contract alone. The hub's origin is chosen once, because moving it would strand stored data; a single origin with sites as paths is the only setup that is silent in every browser. A backend links each site's anonymous account into one xAPI Person when the learner opts in, and the deterministic statement ids make every resend safe.
