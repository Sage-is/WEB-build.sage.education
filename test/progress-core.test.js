import { describe, expect, test } from "bun:test";
import core from "../src/assets/progress-core.js";
import achievements from "../src/_data/achievements.js";
import taxonomy from "../src/_data/taxonomy.js";

const SITE = { url: "https://build.sage.education", origin: "http://localhost:8080" };
const T0 = "2026-10-20T10:00:00.000Z";
const at = (hours) => new Date(Date.parse(T0) + hours * 3600000).toISOString();
const digest = crypto.subtle.digest.bind(crypto.subtle);

function lessonMeta(level, labels, extra = {}) {
  return { title: `A ${level} build`, level, timeEstimate: "weekend", sourceHash: "sha256:a", labels, ...extra };
}

function finish(state, slug, meta, when) {
  core.sync(state, slug, meta);
  meta.labels.forEach((_, i) => core.tick(state, slug, i, true, when, taxonomy.timeTargets));
}

describe("migrate", () => {
  test("turns the old index lists into dated ticks", () => {
    const s = core.migrate({ linktree: [0, 2], bitly: [] , "Bad Slug": [1] }, T0);
    expect(s.lessons.linktree.steps).toEqual({ 0: T0, 2: T0 });
    expect(s.lessons.linktree.startedAt).toBe(T0);
    expect(s.lessons.bitly.startedAt).toBeNull();
    expect(s.lessons["Bad Slug"]).toBeUndefined();
  });
});

describe("normalize", () => {
  test("drops unknown keys, bad dates and non-http links", () => {
    const s = core.normalize({
      evil: 1,
      learner: { name: "Ada", uuid: "not-a-uuid" },
      lessons: {
        linktree: {
          steps: { 0: T0, x: T0, 1: "yesterday" },
          evidenceUrl: "javascript:alert(1)",
          level: "wizard",
          extra: true,
          completion: { modes: { WE: -1, HACK: 3 }, duration: "soon" },
        },
      },
      awards: { "path-beginner": { awardedAt: "nope" } },
    });
    expect(s.evil).toBeUndefined();
    expect(s.learner.uuid).toBe("");
    expect(s.lessons.linktree.steps).toEqual({ 0: T0 });
    expect(s.lessons.linktree.evidenceUrl).toBe("");
    expect(s.lessons.linktree.level).toBe("");
    expect(s.lessons.linktree.extra).toBeUndefined();
    expect(s.lessons.linktree.completion).toEqual({ modes: { WE: 0, MANUALLY: 0, DELEGATE: 0 }, duration: "" });
    expect(s.awards).toEqual({});
  });
});

describe("ticking and completion", () => {
  test("first tick starts the lesson and sets the default goal", () => {
    const s = core.empty();
    core.sync(s, "linktree", lessonMeta("beginner", ["DELEGATE", "WE", "MANUALLY"]));
    core.tick(s, "linktree", 0, true, T0, taxonomy.timeTargets);
    const l = s.lessons.linktree;
    expect(l.startedAt).toBe(T0);
    expect(l.lastProgressAt).toBe(T0);
    expect(l.goal.by).toBe("estimate");
    expect(l.goal.dueAt).toBe(core.goalFor(T0, "weekend", taxonomy.timeTargets));
  });

  test("completion and withinGoal are sticky", () => {
    const s = core.empty();
    finish(s, "linktree", lessonMeta("beginner", ["DELEGATE", "WE", "MANUALLY"]), T0);
    const l = s.lessons.linktree;
    expect(l.completedAt).toBe(T0);
    expect(l.withinGoal).toBe(true);
    core.tick(s, "linktree", 1, false, at(1), taxonomy.timeTargets);
    expect(l.completedAt).toBe(T0);
    expect(l.withinGoal).toBe(true);
  });

  test("finishing after the goal records withinGoal false", () => {
    const s = core.empty();
    core.sync(s, "linktree", lessonMeta("beginner", ["WE", "WE"]));
    core.tick(s, "linktree", 0, true, T0, taxonomy.timeTargets);
    core.tick(s, "linktree", 1, true, at(24 * 30), taxonomy.timeTargets);
    expect(s.lessons.linktree.withinGoal).toBe(false);
  });

  test("a changed sourceHash clears ticks and keeps the completion", () => {
    const s = core.empty();
    const meta = lessonMeta("beginner", ["WE", "WE"]);
    finish(s, "linktree", meta, T0);
    const reset = core.sync(s, "linktree", { ...meta, sourceHash: "sha256:b" });
    expect(reset).toBe(true);
    expect(s.lessons.linktree.steps).toEqual({});
    expect(s.lessons.linktree.completedAt).toBe(T0);
    expect(core.sync(s, "linktree", { ...meta, sourceHash: "sha256:b" })).toBe(false);
  });
});

describe("goals", () => {
  test("goalFor uses the estimate's days and ends the day", () => {
    const due = new Date(core.goalFor(T0, "one-sitting", taxonomy.timeTargets));
    const start = new Date(T0);
    expect(Math.round((due - start) / 86400000)).toBeGreaterThanOrEqual(2);
    expect(due.getHours()).toBe(23);
    expect(due.getMinutes()).toBe(59);
  });

  test("an unknown estimate falls back to two weeks", () => {
    const days = (Date.parse(core.goalFor(T0, "mystery", {})) - Date.parse(T0)) / 86400000;
    expect(days).toBeGreaterThan(14);
    expect(days).toBeLessThan(15);
  });

  test("presets: weekend lands on a Sunday, numbers count days, junk is refused", () => {
    expect(new Date(core.presetDue("weekend", T0)).getDay()).toBe(0);
    const week = (Date.parse(core.presetDue("7", T0)) - Date.parse(T0)) / 86400000;
    expect(week).toBeGreaterThan(7);
    expect(week).toBeLessThan(8);
    expect(core.presetDue("9999", T0)).toBeNull();
    expect(core.presetDue("soon", T0)).toBeNull();
  });

  test("the goal locks once the lesson is finished", () => {
    const s = core.empty();
    finish(s, "linktree", lessonMeta("beginner", ["WE"]), T0);
    expect(core.setGoal(s, "linktree", at(48), at(1))).toBe(false);
    const s2 = core.empty();
    core.sync(s2, "bitly", lessonMeta("beginner", ["WE", "WE"]));
    expect(core.setGoal(s2, "bitly", at(48), T0)).toBe(true);
    expect(s2.lessons.bitly.goal.by).toBe("learner");
  });
});

describe("evaluate", () => {
  test("awards paths, modes and stretch once, and never takes them back", () => {
    const s = core.empty();
    ["one", "two", "three"].forEach((slug) => finish(s, slug, lessonMeta("beginner", ["MANUALLY", "MANUALLY"]), T0));
    core.sync(s, "four", lessonMeta("intermediate", ["DELEGATE"]));
    [0, 1, 2].forEach((i) => core.tickStretch(s, "four", i, true, T0));
    const fresh = core.evaluate(s, achievements, at(1));
    expect(fresh).toEqual(["lesson-one", "lesson-two", "lesson-three", "path-beginner", "mode-manually", "stretch"]);
    expect(core.evaluate(s, achievements, at(2))).toEqual([]);
    core.tick(s, "one", 0, false, at(3), taxonomy.timeTargets);
    core.tickStretch(s, "four", 0, false, at(3));
    expect(core.evaluate(s, achievements, at(4))).toEqual([]);
    expect(s.awards["path-beginner"].awardedAt).toBe(at(1));
    expect(s.awards["lesson-one"].awardedAt).toBe(T0);
  });
});

describe("merge", () => {
  test("unions ticks, keeps earliest dates and local text", () => {
    const a = core.empty();
    core.sync(a, "linktree", lessonMeta("beginner", ["WE", "WE"]));
    core.tick(a, "linktree", 0, true, at(5), taxonomy.timeTargets);
    a.lessons.linktree.reflection = "mine";
    const b = core.empty();
    core.sync(b, "linktree", lessonMeta("beginner", ["WE", "WE"]));
    core.tick(b, "linktree", 0, true, at(1), taxonomy.timeTargets);
    core.tick(b, "linktree", 1, true, at(2), taxonomy.timeTargets);
    b.lessons.linktree.reflection = "theirs";
    b.awards["path-beginner"] = { awardedAt: at(3), version: 1 };
    const m = core.merge(a, b);
    expect(m.lessons.linktree.steps).toEqual({ 0: at(1), 1: at(2) });
    expect(m.lessons.linktree.startedAt).toBe(at(1));
    expect(m.lessons.linktree.completedAt).toBe(at(2));
    expect(m.lessons.linktree.completion).toEqual({ modes: { WE: 2, MANUALLY: 0, DELEGATE: 0 }, duration: "PT1H" });
    expect(m.lessons.linktree.reflection).toBe("mine");
    expect(m.awards["path-beginner"].awardedAt).toBe(at(3));
  });

  test("a backup restored onto a blank state keeps its learner uuid", () => {
    const backup = core.empty();
    backup.learner.uuid = "11111111-1111-4111-8111-111111111111";
    finish(backup, "linktree", lessonMeta("beginner", ["WE"]), T0);
    const blank = core.empty();
    blank.learner.uuid = "22222222-2222-4222-8222-222222222222";
    expect(core.merge(blank, backup).learner.uuid).toBe(backup.learner.uuid);
    const busy = core.empty();
    busy.learner.uuid = "33333333-3333-4333-8333-333333333333";
    finish(busy, "bitly", lessonMeta("beginner", ["WE"]), T0);
    expect(core.merge(busy, backup).learner.uuid).toBe(busy.learner.uuid);
  });
});

describe("LLR views", () => {
  function sample() {
    const s = core.empty();
    s.learner = { name: "Ada Lovelace", uuid: "0b6f4c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f" };
    finish(s, "linktree", lessonMeta("beginner", ["DELEGATE", "WE", "MANUALLY"]), T0);
    s.lessons.linktree.evidenceUrl = "https://example.com/my-links";
    s.lessons.linktree.reflection = "I would add a theme switcher.";
    core.sync(s, "bitly", lessonMeta("beginner", ["WE", "WE"]));
    core.tick(s, "bitly", 0, true, at(2), taxonomy.timeTargets);
    core.evaluate(s, achievements, at(3));
    return s;
  }

  test("the summary carries no name, links or reflections", () => {
    const summary = core.toSummary(sample(), SITE, {});
    const text = JSON.stringify(summary);
    expect(text).not.toContain("Ada");
    expect(text).not.toContain("example.com");
    expect(text).not.toContain("theme switcher");
    expect(summary.courses[0].id).toBe("https://build.sage.education/lessons/bitly/");
    expect(summary.courses[0].resumeUrl).toBe("http://localhost:8080/lessons/bitly/#step-1");
    expect(summary.courses[1].done).toBe(3);
  });

  test("statements meet xAPI 2.0 and get stable ids", async () => {
    const s = sample();
    const first = await core.toStatements(s, SITE, digest, {});
    const again = await core.toStatements(s, SITE, digest, {});
    expect(first.map((x) => x.id)).toEqual(again.map((x) => x.id));
    expect(new Set(first.map((x) => x.id)).size).toBe(first.length);
    for (const st of first) {
      expect(st.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(st.actor.account).toEqual({ homePage: SITE.url, name: s.learner.uuid });
      expect(st.actor.name).toBeUndefined();
      expect(st.actor.mbox).toBeUndefined();
      expect(st.verb.id).toMatch(/^https?:\/\//);
      expect(st.object.id).toMatch(/^https:\/\/build\.sage\.education\//);
      expect(Date.parse(st.timestamp)).not.toBeNaN();
      expect(st.version).toBeUndefined();
    }
    const completed = first.find((x) => x.verb.id.endsWith("/completed"));
    expect(completed.result.completion).toBe(true);
    expect(completed.result.duration).toBe("PT0M");
    expect(completed.result.extensions[SITE.url + "/xapi/extensions/step-modes"]).toEqual({ WE: 1, MANUALLY: 1, DELEGATE: 1 });
    const progressed = first.filter((x) => x.verb.id.endsWith("/progressed"));
    expect(progressed.length).toBe(4);
    expect(progressed.every((x) => x.object.id.endsWith("/") && x.result === undefined)).toBe(true);
    const goals = first.filter((x) => x.verb.id === SITE.url + "/xapi/verbs/set-goal");
    expect(goals.length).toBe(2);
    expect(goals[0].context.extensions[SITE.url + "/xapi/extensions/goal-by"]).toBe("estimate");
    expect(JSON.stringify(first)).not.toContain("Ada");
  });

  // An LRS answers 409 when a known id arrives with different content, and
  // fails the whole batch with it.
  test("a resent id never carries new content", async () => {
    const s = core.empty();
    s.learner.uuid = "0b6f4c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
    const meta = lessonMeta("beginner", ["DELEGATE", "WE", "MANUALLY"]);
    core.sync(s, "linktree", meta);
    core.tick(s, "linktree", 0, true, at(0), taxonomy.timeTargets);
    core.tick(s, "linktree", 1, true, at(1), taxonomy.timeTargets);
    const early = await core.toStatements(s, SITE, digest, {});
    // Move the goal, untick the first step, finish, then relabel the lesson.
    core.setGoal(s, "linktree", at(24 * 5), at(2));
    core.tick(s, "linktree", 0, false, at(3), taxonomy.timeTargets);
    core.tick(s, "linktree", 2, true, at(4), taxonomy.timeTargets);
    core.tick(s, "linktree", 0, true, at(5), taxonomy.timeTargets);
    const finished = await core.toStatements(s, SITE, digest, {});
    core.sync(s, "linktree", { ...meta, labels: ["WE", "WE", "WE"] });
    const relabelled = await core.toStatements(s, SITE, digest, {});
    const seen = new Map();
    for (const batch of [early, finished, relabelled]) {
      for (const st of batch) {
        const body = JSON.stringify(st);
        if (seen.has(st.id)) expect(body).toBe(seen.get(st.id));
        else seen.set(st.id, body);
      }
    }
    expect(finished.filter((x) => x.verb.id.endsWith("/set-goal")).length).toBe(1);
  });

  test("statements can be limited to one lesson", async () => {
    const only = await core.toStatements(sample(), SITE, digest, {}, "bitly");
    expect(only.every((x) => x.object.id.includes("bitly"))).toBe(true);
  });

  test("claims cite steps and the project link", () => {
    const claims = core.toClaims(sample(), SITE);
    const lesson = claims.find((c) => c.achievement.endsWith("/lesson-linktree.json"));
    expect(lesson.evidence).toContain("https://example.com/my-links");
    expect(lesson.evidence).toContain("https://build.sage.education/lessons/linktree/#step-0");
  });

  test("durations are ISO 8601", () => {
    expect(core.duration(18 * 60000)).toBe("PT18M");
    expect(core.duration((2 * 1440 + 3 * 60 + 4) * 60000)).toBe("P2DT3H4M");
    expect(core.duration(3 * 1440 * 60000)).toBe("P3D");
    expect(core.duration(2 * 3600000)).toBe("PT2H");
  });
});
