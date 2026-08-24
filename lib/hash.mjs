import { createHash } from "node:crypto";

// Canonical JSON: object keys sorted recursively, no whitespace. Upstream
// formatting churn (key order, indentation) must not change the hash.
export function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function entryHash(entry) {
  return (
    "sha256:" + createHash("sha256").update(canonicalize(entry)).digest("hex")
  );
}
