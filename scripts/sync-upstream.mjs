// Sync upstream canivibecodeit data/apps/*.json into data/upstream/apps/.
// Tarball download — no clone, no git dependency, works the same locally and
// on the cluster. Full replace (delete-then-write) so upstream deletions
// propagate. Prints an added/changed/removed summary against the previous
// synced state, compared by canonical hash.
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { entryHash } from "../lib/hash.mjs";

const REPO = "canivibecodeit/canivibecodeit";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = join(ROOT, "data", "upstream", "apps");
const META = join(ROOT, "data", "upstream", "UPSTREAM.json");

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status}`);
  return res.json();
}

const repoInfo = await gh(`/repos/${REPO}`);
const branch = repoInfo.default_branch;
const head = await gh(`/repos/${REPO}/commits/${branch}`);
const sha = head.sha;

console.log(`upstream ${REPO}@${branch} → ${sha.slice(0, 10)}`);

// Previous state, keyed by slug → hash, for the change summary.
const before = new Map();
try {
  for (const f of readdirSync(DEST)) {
    if (!f.endsWith(".json")) continue;
    const entry = JSON.parse(readFileSync(join(DEST, f), "utf8"));
    before.set(f.replace(/\.json$/, ""), entryHash(entry));
  }
} catch {
  // first sync: no previous state
}

const tmp = mkdtempSync(join(tmpdir(), "cvci-sync-"));
try {
  const tarPath = join(tmp, "upstream.tar.gz");
  const res = await fetch(`https://codeload.github.com/${REPO}/tar.gz/${sha}`);
  if (!res.ok) throw new Error(`tarball download failed: ${res.status}`);
  writeFileSync(tarPath, Buffer.from(await res.arrayBuffer()));

  // Extract everything, then copy only data/apps/*.json — avoids GNU/BSD tar
  // wildcard flag differences.
  const extractDir = join(tmp, "x");
  mkdirSync(extractDir);
  execFileSync("tar", ["-xzf", tarPath, "-C", extractDir]);
  const rootDir = readdirSync(extractDir).find((d) => !d.startsWith("."));
  const appsDir = join(extractDir, rootDir, "data", "apps");

  rmSync(DEST, { recursive: true, force: true });
  mkdirSync(DEST, { recursive: true });

  const after = new Map();
  for (const f of readdirSync(appsDir).sort()) {
    if (!f.endsWith(".json")) continue;
    const raw = readFileSync(join(appsDir, f), "utf8");
    writeFileSync(join(DEST, f), raw);
    after.set(f.replace(/\.json$/, ""), entryHash(JSON.parse(raw)));
  }

  writeFileSync(
    META,
    JSON.stringify(
      {
        repo: `https://github.com/${REPO}`,
        branch,
        commitSha: sha,
        syncedAt: new Date().toISOString(),
        entryCount: after.size,
      },
      null,
      2,
    ) + "\n",
  );

  const added = [...after.keys()].filter((s) => !before.has(s));
  const removed = [...before.keys()].filter((s) => !after.has(s));
  const changed = [...after.keys()].filter(
    (s) => before.has(s) && before.get(s) !== after.get(s),
  );

  console.log(`entries: ${after.size}`);
  console.log(`added:   ${added.length}${added.length ? "  " + added.slice(0, 20).join(", ") : ""}`);
  console.log(`changed: ${changed.length}${changed.length ? "  " + changed.slice(0, 20).join(", ") : ""}`);
  console.log(`removed: ${removed.length}${removed.length ? "  " + removed.join(", ") : ""}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
