// Joins entries with generated overlays. Only slugs with an overlay render as
// lessons; the overlay validator (make validate) is the quality gate before
// this join ever sees a file.
//
// An entry comes from one of two places. Upstream entries live in
// data/upstream/apps/ and are a verbatim MIT mirror. First-party entries live
// in data/first-party/ and describe projects we build ourselves, which have no
// upstream entry to mirror. Same shape either way, so every rule in the
// validator stays armed.
const { readdirSync, readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const ROOT = join(__dirname, "..", "..");
const OVERLAYS = join(ROOT, "data", "overlays");
const APPS = join(ROOT, "data", "upstream", "apps");
const FIRST_PARTY = join(ROOT, "data", "first-party");
const ICONS = join(ROOT, "src", "assets", "icons");

module.exports = function () {
  if (!existsSync(OVERLAYS)) return [];
  const lessons = [];
  for (const f of readdirSync(OVERLAYS).sort()) {
    if (!f.endsWith(".json")) continue;
    // First-party lessons supply their own entry; upstream is the fallback.
    const firstPartyPath = join(FIRST_PARTY, f);
    const entryPath = existsSync(firstPartyPath)
      ? firstPartyPath
      : join(APPS, f);
    if (!existsSync(entryPath)) continue;
    const overlay = JSON.parse(readFileSync(join(OVERLAYS, f), "utf8"));
    const entry = JSON.parse(readFileSync(entryPath, "utf8"));
    const icon = existsSync(join(ICONS, `${overlay.slug}.png`))
      ? `/assets/icons/${overlay.slug}.png`
      : null;
    lessons.push({ slug: overlay.slug, overlay, entry, icon });
  }
  lessons.sort((a, b) => a.overlay.title.localeCompare(b.overlay.title));
  return lessons;
};
