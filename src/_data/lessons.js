// Joins upstream entries with generated overlays. Only slugs with an overlay
// render as lessons; the overlay validator (make validate) is the quality
// gate before this join ever sees a file.
const { readdirSync, readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const ROOT = join(__dirname, "..", "..");
const OVERLAYS = join(ROOT, "data", "overlays");
const APPS = join(ROOT, "data", "upstream", "apps");
const ICONS = join(ROOT, "src", "assets", "icons");

module.exports = function () {
  if (!existsSync(OVERLAYS)) return [];
  const lessons = [];
  for (const f of readdirSync(OVERLAYS).sort()) {
    if (!f.endsWith(".json")) continue;
    const entryPath = join(APPS, f);
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
