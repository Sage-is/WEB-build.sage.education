import { describe, expect, test } from "bun:test";
import llr from "../src/assets/llr.js";
import core from "../src/assets/progress-core.js";
import taxonomy from "../src/_data/taxonomy.js";

const BUILD = "https://build.sage.education";
const HOME = "https://sage.education";
const registry = {
  sites: [
    { origin: HOME, name: "Sage.Education" },
    { origin: BUILD, name: "Build it yourself" },
  ],
};
const NOW = "2026-10-27T12:00:00.000Z";

function payload(over = {}) {
  return {
    llr: 1,
    src: BUILD,
    kind: "summary",
    at: NOW,
    body: {
      courses: [
        {
          id: `${BUILD}/lessons/bitly/`,
          title: "Build your own link shortener",
          url: `${BUILD}/lessons/bitly/`,
          done: 1,
          total: 3,
          resumeUrl: `${BUILD}/lessons/bitly/#step-1`,
          startedAt: NOW,
          lastProgressAt: NOW,
          dueAt: NOW,
          completedAt: "",
          withinGoal: null,
        },
      ],
      awards: [],
    },
    ...over,
  };
}

describe("encode and decode", () => {
  test("round-trip a payload", async () => {
    const text = await llr.encode(payload());
    expect(text).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(await llr.decode(text)).toEqual(payload());
  });

  test("refuse anything malformed or oversized", async () => {
    expect(await llr.decode("2.abc")).toBeNull();
    expect(await llr.decode("1.not*base64")).toBeNull();
    expect(await llr.decode("1.AAAA")).toBeNull();
    expect(await llr.decode("1." + "A".repeat(70000))).toBeNull();
    expect(await llr.decode(undefined)).toBeNull();
  });
});

describe("accept", () => {
  test("keeps a registered source whose referrer agrees", () => {
    const snap = llr.accept(payload(), `${BUILD}/lessons/bitly/`, registry, HOME);
    expect(snap.src).toBe(BUILD);
    expect(snap.name).toBe("Build it yourself");
    expect(snap.summary.courses[0].resumeUrl).toBe(`${BUILD}/lessons/bitly/#step-1`);
  });

  test("drops a crafted link: no referrer, another referrer, or an unregistered source", () => {
    expect(llr.accept(payload(), "", registry, HOME)).toBeNull();
    expect(llr.accept(payload(), "https://evil.example/", registry, HOME)).toBeNull();
    expect(llr.accept(payload({ src: "https://evil.example" }), "https://evil.example/", registry, HOME)).toBeNull();
  });

  test("ignores its own origin, other kinds and other versions", () => {
    expect(llr.accept(payload(), `${BUILD}/`, registry, BUILD)).toBeNull();
    expect(llr.accept(payload({ kind: "statements" }), `${BUILD}/`, registry, HOME)).toBeNull();
    expect(llr.accept(payload({ llr: 2 }), `${BUILD}/`, registry, HOME)).toBeNull();
  });

  test("confines links to the source origin and drops extra fields", () => {
    const p = payload();
    p.body.courses.push({ title: "Phish", url: "https://evil.example/", done: 1, total: 2 });
    p.body.courses[0].resumeUrl = "javascript:alert(1)";
    p.body.courses[0].learnerName = "Ada";
    p.body.courses[0].done = 9999;
    const snap = llr.accept(p, `${BUILD}/`, registry, HOME);
    expect(snap.summary.courses.length).toBe(1);
    expect(snap.summary.courses[0].resumeUrl).toBe(`${BUILD}/lessons/bitly/`);
    expect(snap.summary.courses[0].learnerName).toBeUndefined();
    expect(snap.summary.courses[0].done).toBe(0);
  });
});

describe("allowedReturn", () => {
  const servers = [{ base: "https://sage.example.org/sage/", caps: ["llr-import"] }];

  test("allows registered sites and confirmed servers only", () => {
    expect(llr.allowedReturn(`${HOME}/classroom/`, registry, [])).toBe(`${HOME}/classroom/`);
    expect(llr.allowedReturn("https://sage.example.org/sage/learn/", registry, servers)).toBe("https://sage.example.org/sage/learn/");
    expect(llr.allowedReturn("https://evil.example/", registry, servers)).toBe("");
    expect(llr.allowedReturn("javascript:alert(1)", registry, servers)).toBe("");
    expect(llr.allowedReturn("", registry, servers)).toBe("");
  });
});

describe("parseServer", () => {
  test("keeps the base path and only well-formed capabilities", () => {
    expect(llr.parseServer("https://sage.example.org/sage", "llr-import, Bad Cap,x")).toEqual({
      base: "https://sage.example.org/sage/",
      caps: ["llr-import", "x"],
    });
    expect(llr.parseServer("https://sage.example.org", "")).toEqual({ base: "https://sage.example.org/", caps: [] });
  });

  test("refuses anything that is not http(s)", () => {
    expect(llr.parseServer("javascript:alert(1)", "")).toBeNull();
    expect(llr.parseServer("not a url", "")).toBeNull();
  });

  test("import lands under the base", () => {
    expect(llr.importUrl("https://sage.example.org/sage/")).toBe("https://sage.example.org/sage/learn/import");
  });
});

describe("core summary through the wire", () => {
  test("arrives intact and private", async () => {
    const s = core.empty();
    s.learner = { name: "Ada Lovelace", uuid: "0b6f4c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f" };
    core.sync(s, "bitly", { title: "Build your own link shortener", level: "beginner", timeEstimate: "one-sitting", sourceHash: "sha256:a", labels: ["DELEGATE", "WE", "MANUALLY"] });
    core.tick(s, "bitly", 0, true, NOW, taxonomy.timeTargets);
    s.lessons.bitly.reflection = "private note";
    s.lessons.bitly.evidenceUrl = "https://example.com/mine";
    const summary = core.toSummary(s, { url: BUILD, origin: BUILD }, {});
    const text = await llr.encode({ llr: 1, src: BUILD, kind: "summary", at: NOW, body: summary });
    const snap = llr.accept(await llr.decode(text), `${BUILD}/lessons/bitly/`, registry, HOME);
    expect(snap.summary.courses[0].title).toBe("Build your own link shortener");
    expect(snap.summary.courses[0].done).toBe(1);
    const wire = JSON.stringify(await llr.decode(text));
    expect(wire).not.toContain("Ada");
    expect(wire).not.toContain("private note");
    expect(wire).not.toContain("example.com/mine");
  });
});
