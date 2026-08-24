import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MAP = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "data", "time-map.json"),
    "utf8",
  ),
);

export const TIME_ENUM = MAP.enum;

// Exact match first, then ordered rules (prefix beats contains by rule order),
// else the fallback. Case-insensitive, trimmed.
export function resolveTimeEstimate(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s in MAP.exact) return MAP.exact[s];
  for (const rule of MAP.rules) {
    if (rule.match === "prefix" && s.startsWith(rule.text)) return rule.to;
    if (rule.match === "contains" && s.includes(rule.text)) return rule.to;
  }
  return MAP.fallback;
}
