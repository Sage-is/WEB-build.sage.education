// Progress state for build.sage.education, as pure functions. No DOM and no
// storage here: progress.js owns those. The same file loads in the browser
// (window.SageProgressCore) and in bun tests (module.exports).
//
// State lives in the learner's browser only, under localStorage "sage-build":
//   { schema, learner: { name, uuid }, lessons: { <slug>: Lesson }, awards: { <id>: { awardedAt, version } } }
//   Lesson: { title, level, timeEstimate, sourceHash, labels, steps: { <i>: iso },
//             stretch: { <i>: iso }, startedAt, lastProgressAt,
//             goal: { dueAt, by, setAt }, completedAt, withinGoal,
//             completion: { modes, duration }, evidenceUrl, reflection }
// Completion, withinGoal and awards are sticky: unticking never takes them back.
// `completion` freezes what the finish recorded, so its statement never changes.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SageProgressCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var SCHEMA = 1;
  var DAY = 86400000;
  var LEVELS = ["beginner", "intermediate", "advanced"];
  var LABELS = ["WE", "MANUALLY", "DELEGATE"];

  var VERB = {
    attempted: "http://adlnet.gov/expapi/verbs/attempted",
    progressed: "http://adlnet.gov/expapi/verbs/progressed",
    completed: "http://adlnet.gov/expapi/verbs/completed",
    earned: "http://id.tincanapi.com/verb/earned",
  };
  var LESSON_TYPE = "http://adlnet.gov/expapi/activities/lesson";

  function empty() {
    return { schema: SCHEMA, learner: { name: "", uuid: "" }, lessons: {}, awards: {} };
  }

  // ── Small guards ───────────────────────────────────────────────────────

  function isObj(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function str(v, max) {
    return typeof v === "string" ? v.slice(0, max || 500) : "";
  }
  function iso(v) {
    return typeof v === "string" && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;
  }
  function httpUrl(v) {
    if (typeof v !== "string" || !v) return "";
    try {
      var u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
    } catch (e) {
      return "";
    }
  }
  function earliest(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return a < b ? a : b;
  }
  function latest(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return a > b ? a : b;
  }
  // Ticks are { "<index>": iso }. Anything else is dropped.
  function ticks(v) {
    var out = {};
    if (!isObj(v)) return out;
    Object.keys(v).forEach(function (k) {
      var at = iso(v[k]);
      if (/^\d{1,2}$/.test(k) && at) out[k] = at;
    });
    return out;
  }
  // A completion is { modes: { WE, MANUALLY, DELEGATE }, duration }.
  function completion(v) {
    if (!isObj(v) || !isObj(v.modes)) return null;
    var modes = {};
    LABELS.forEach(function (k) {
      var n = v.modes[k];
      modes[k] = Number.isInteger(n) && n >= 0 && n <= 100 ? n : 0;
    });
    var d = typeof v.duration === "string" && /^P(\d+D)?(T(\d+H)?(\d+M)?)?$/.test(v.duration) ? v.duration : "";
    return { modes: modes, duration: d };
  }

  // ── Shape: everything loaded or imported passes through here ───────────

  function normalizeLesson(l) {
    if (!isObj(l)) return null;
    var goal = null;
    if (isObj(l.goal) && iso(l.goal.dueAt)) {
      goal = {
        dueAt: iso(l.goal.dueAt),
        by: l.goal.by === "learner" ? "learner" : "estimate",
        setAt: iso(l.goal.setAt) || iso(l.goal.dueAt),
      };
    }
    return {
      title: str(l.title, 200),
      level: LEVELS.indexOf(l.level) !== -1 ? l.level : "",
      timeEstimate: str(l.timeEstimate, 40),
      sourceHash: str(l.sourceHash, 80),
      labels: Array.isArray(l.labels)
        ? l.labels.filter(function (x) { return LABELS.indexOf(x) !== -1; }).slice(0, 20)
        : [],
      steps: ticks(l.steps),
      stretch: ticks(l.stretch),
      startedAt: iso(l.startedAt),
      lastProgressAt: iso(l.lastProgressAt),
      goal: goal,
      completedAt: iso(l.completedAt),
      withinGoal: typeof l.withinGoal === "boolean" ? l.withinGoal : null,
      completion: completion(l.completion),
      evidenceUrl: httpUrl(l.evidenceUrl),
      reflection: str(l.reflection, 2000),
    };
  }

  function normalize(raw) {
    var s = empty();
    if (!isObj(raw)) return s;
    if (isObj(raw.learner)) {
      s.learner.name = str(raw.learner.name, 120);
      s.learner.uuid = /^[0-9a-f-]{36}$/.test(raw.learner.uuid || "") ? raw.learner.uuid : "";
    }
    if (isObj(raw.lessons)) {
      Object.keys(raw.lessons).forEach(function (slug) {
        if (!/^[a-z0-9-]{1,80}$/.test(slug)) return;
        var l = normalizeLesson(raw.lessons[slug]);
        if (l) s.lessons[slug] = l;
      });
    }
    if (isObj(raw.awards)) {
      Object.keys(raw.awards).forEach(function (id) {
        var a = raw.awards[id];
        if (!/^[a-z0-9-]{1,100}$/.test(id) || !isObj(a) || !iso(a.awardedAt)) return;
        s.awards[id] = { awardedAt: iso(a.awardedAt), version: Number(a.version) || 1 };
      });
    }
    return s;
  }

  // The first version kept { slug: [checkedIndex, …] } under
  // "sage-build-progress", with no dates. Migrated ticks take `now`.
  function migrate(old, now) {
    var s = empty();
    if (!isObj(old)) return s;
    Object.keys(old).forEach(function (slug) {
      if (!/^[a-z0-9-]{1,80}$/.test(slug) || !Array.isArray(old[slug])) return;
      var l = normalizeLesson({});
      old[slug].forEach(function (i) {
        if (Number.isInteger(i) && i >= 0 && i < 100) l.steps[String(i)] = now;
      });
      if (Object.keys(l.steps).length) {
        l.startedAt = now;
        l.lastProgressAt = now;
      }
      s.lessons[slug] = l;
    });
    return s;
  }

  // ── Lessons ────────────────────────────────────────────────────────────

  function lessonOf(state, slug) {
    if (!state.lessons[slug]) state.lessons[slug] = normalizeLesson({});
    return state.lessons[slug];
  }

  // Bring a record in line with the page that describes it. A different
  // sourceHash means the steps were regenerated, so old indexes may point at
  // new steps: ticks go, the completion stays. Returns true when it reset.
  function sync(state, slug, meta) {
    var l = lessonOf(state, slug);
    var reset = false;
    if (l.sourceHash && meta.sourceHash && l.sourceHash !== meta.sourceHash) {
      reset = Object.keys(l.steps).length > 0 || Object.keys(l.stretch).length > 0;
      l.steps = {};
      l.stretch = {};
    }
    l.title = str(meta.title, 200) || l.title;
    l.level = LEVELS.indexOf(meta.level) !== -1 ? meta.level : l.level;
    l.timeEstimate = str(meta.timeEstimate, 40) || l.timeEstimate;
    l.sourceHash = str(meta.sourceHash, 80) || l.sourceHash;
    var labels = Array.isArray(meta.labels)
      ? meta.labels.filter(function (x) { return LABELS.indexOf(x) !== -1; }).slice(0, 20)
      : [];
    if (labels.length) l.labels = labels;
    return reset;
  }

  function total(l) {
    return l.labels.length;
  }
  function doneCount(l) {
    var n = 0;
    for (var i = 0; i < total(l); i++) if (l.steps[String(i)]) n++;
    return n;
  }
  function nextStep(l) {
    for (var i = 0; i < total(l); i++) if (!l.steps[String(i)]) return i;
    return -1;
  }

  // ── Time goals ─────────────────────────────────────────────────────────

  function endOfDay(ms) {
    var d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
  }

  // The default goal: the end of the day `targets[timeEstimate]` days after
  // the start. Unknown estimates fall back to two weeks.
  function goalFor(startedAt, timeEstimate, targets) {
    var days = (targets && targets[timeEstimate]) || 14;
    return endOfDay(Date.parse(startedAt) + days * DAY);
  }

  // Preset goals measured from `now`: "today", "weekend" (the coming
  // Sunday), or a number of days.
  function presetDue(preset, now) {
    var t = Date.parse(now);
    if (preset === "today") return endOfDay(t);
    if (preset === "weekend") {
      var d = new Date(t);
      return endOfDay(t + ((7 - d.getDay()) % 7) * DAY);
    }
    var days = parseInt(preset, 10);
    return days > 0 && days <= 365 ? endOfDay(t + days * DAY) : null;
  }

  function start(state, slug, now, targets) {
    var l = lessonOf(state, slug);
    if (!l.startedAt) l.startedAt = now;
    if (!l.goal) l.goal = { dueAt: goalFor(l.startedAt, l.timeEstimate, targets), by: "estimate", setAt: now };
    return l;
  }

  // A finished lesson keeps the goal it was finished against.
  function setGoal(state, slug, dueAt, now) {
    var l = lessonOf(state, slug);
    var due = iso(dueAt);
    if (l.completedAt || !due) return false;
    l.goal = { dueAt: due, by: "learner", setAt: now };
    return true;
  }

  // ── Ticking ────────────────────────────────────────────────────────────

  // Step counts by mode and the time from start to finish, taken at the
  // moment of completion.
  function completionOf(l, now) {
    var modes = { WE: 0, MANUALLY: 0, DELEGATE: 0 };
    l.labels.forEach(function (label) { if (modes[label] !== undefined) modes[label]++; });
    return { modes: modes, duration: l.startedAt ? duration(Date.parse(now) - Date.parse(l.startedAt)) : "" };
  }

  function tick(state, slug, index, checked, now, targets) {
    var l = lessonOf(state, slug);
    var k = String(index);
    if (checked) {
      start(state, slug, now, targets);
      if (!l.steps[k]) l.steps[k] = now;
      l.lastProgressAt = now;
    } else {
      delete l.steps[k];
    }
    if (!l.completedAt && total(l) > 0 && doneCount(l) === total(l)) {
      l.completedAt = now;
      l.withinGoal = l.goal ? now <= l.goal.dueAt : null;
      l.completion = completionOf(l, now);
    }
    return l;
  }

  function tickStretch(state, slug, index, checked, now) {
    var l = lessonOf(state, slug);
    var k = String(index);
    if (checked) {
      if (!l.stretch[k]) l.stretch[k] = now;
      l.lastProgressAt = now;
    } else {
      delete l.stretch[k];
    }
    return l;
  }

  // ── Awards ─────────────────────────────────────────────────────────────

  function counts(state) {
    var c = { lessons: { beginner: 0, intermediate: 0, advanced: 0 }, modes: { WE: 0, MANUALLY: 0, DELEGATE: 0 }, stretch: 0, finished: 0 };
    Object.keys(state.lessons).forEach(function (slug) {
      var l = state.lessons[slug];
      if (l.completedAt) {
        c.finished++;
        if (c.lessons[l.level] !== undefined) c.lessons[l.level]++;
      }
      Object.keys(l.steps).forEach(function (k) {
        var label = l.labels[Number(k)];
        if (c.modes[label] !== undefined) c.modes[label]++;
      });
      c.stretch += Object.keys(l.stretch).length;
    });
    return c;
  }

  function met(a, c) {
    if (a.kind === "path") return c.lessons[a.level] >= a.count;
    if (a.kind === "mode") return c.modes[a.label] >= a.count;
    if (a.kind === "stretch") return c.stretch >= a.count;
    return false;
  }

  // Award what is newly earned and return those ids, in definition order,
  // with finished lessons first as "lesson-<slug>".
  function evaluate(state, achievements, now) {
    var fresh = [];
    var c = counts(state);
    Object.keys(state.lessons).forEach(function (slug) {
      var id = "lesson-" + slug;
      if (state.lessons[slug].completedAt && !state.awards[id]) {
        state.awards[id] = { awardedAt: state.lessons[slug].completedAt, version: 1 };
        fresh.push(id);
      }
    });
    (achievements || []).forEach(function (a) {
      if (!state.awards[a.id] && met(a, c)) {
        state.awards[a.id] = { awardedAt: now, version: a.version || 1 };
        fresh.push(a.id);
      }
    });
    return fresh;
  }

  // ── Import ─────────────────────────────────────────────────────────────

  // Union of two states: ticks keep the earliest time, completions and
  // awards the earliest date, text the non-empty value (local wins a tie).
  // A backup restored onto a blank state keeps its learner uuid, so the
  // xAPI actor survives an erase-and-restore.
  function merge(local, incoming) {
    var a = normalize(local);
    var b = normalize(incoming);
    var blank = !Object.keys(a.lessons).length && !Object.keys(a.awards).length;
    a.learner.name = a.learner.name || b.learner.name;
    a.learner.uuid = (blank && b.learner.uuid) || a.learner.uuid || b.learner.uuid;
    Object.keys(b.lessons).forEach(function (slug) {
      var x = a.lessons[slug];
      var y = b.lessons[slug];
      if (!x) {
        a.lessons[slug] = y;
        return;
      }
      ["steps", "stretch"].forEach(function (field) {
        Object.keys(y[field]).forEach(function (k) {
          x[field][k] = earliest(x[field][k], y[field][k]);
        });
      });
      ["title", "level", "timeEstimate", "sourceHash", "evidenceUrl", "reflection"].forEach(function (f) {
        x[f] = x[f] || y[f];
      });
      if (!x.labels.length) x.labels = y.labels;
      x.startedAt = earliest(x.startedAt, y.startedAt);
      x.lastProgressAt = latest(x.lastProgressAt, y.lastProgressAt);
      x.goal = x.goal || y.goal;
      if (!x.completedAt || (y.completedAt && y.completedAt < x.completedAt)) {
        if (y.completedAt) {
          x.completedAt = y.completedAt;
          x.withinGoal = y.withinGoal;
          x.completion = y.completion;
        }
      }
    });
    Object.keys(b.awards).forEach(function (id) {
      var x = a.awards[id];
      if (!x || b.awards[id].awardedAt < x.awardedAt) a.awards[id] = b.awards[id];
    });
    return a;
  }

  // ── LLR views: what other sites and later servers may see ──────────────
  //
  // `site` is { url: "https://build.sage.education", origin: location.origin }.
  // IRIs always use site.url; links the learner follows use site.origin.

  function lessonIri(site, slug) {
    return site.url + "/lessons/" + slug + "/";
  }
  function achievementIri(site, id) {
    return site.url + "/achievements/" + id + ".json";
  }

  // Titles, counts and dates only. Never the learner's name, project links
  // or reflections: those stay on this site.
  function toSummary(state, site, names) {
    var courses = Object.keys(state.lessons)
      .filter(function (slug) {
        var l = state.lessons[slug];
        return l.title && (l.startedAt || l.completedAt);
      })
      .map(function (slug) {
        var l = state.lessons[slug];
        var url = site.origin + "/lessons/" + slug + "/";
        var next = nextStep(l);
        return {
          id: lessonIri(site, slug),
          title: l.title,
          url: url,
          done: doneCount(l),
          total: total(l),
          resumeUrl: next === -1 ? url : url + "#step-" + next,
          startedAt: l.startedAt || "",
          lastProgressAt: l.lastProgressAt || "",
          dueAt: l.goal ? l.goal.dueAt : "",
          completedAt: l.completedAt || "",
          withinGoal: l.withinGoal,
        };
      })
      .sort(function (x, y) {
        return (y.lastProgressAt || "").localeCompare(x.lastProgressAt || "");
      });
    var awards = Object.keys(state.awards).map(function (id) {
      return { id: achievementIri(site, id), name: (names && names[id]) || id, awardedAt: state.awards[id].awardedAt };
    });
    return { courses: courses, awards: awards };
  }

  // ISO 8601 duration, whole minutes: PT18M, P2DT3H4M.
  function duration(ms) {
    var m = Math.max(0, Math.round(ms / 60000));
    var d = Math.floor(m / 1440);
    var h = Math.floor((m % 1440) / 60);
    var min = m % 60;
    var out = "P" + (d ? d + "D" : "");
    if (h || min || !d) out += "T" + (h ? h + "H" : "") + (min || !h ? min + "M" : "");
    return out;
  }

  // UUIDv8 from the first 16 bytes of SHA-256 over the event's identity, so
  // the same event always gets the same statement id and an LRS can ignore a
  // resend. `digest` is crypto.subtle.digest bound to crypto.subtle.
  function statementId(digest, parts) {
    var bytes = new TextEncoder().encode(parts.join("|"));
    return digest("SHA-256", bytes).then(function (buf) {
      var b = new Uint8Array(buf).slice(0, 16);
      b[6] = (b[6] & 0x0f) | 0x80;
      b[8] = (b[8] & 0x3f) | 0x80;
      var hex = Array.prototype.map.call(b, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
      return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    });
  }

  // xAPI 2.0 statements derived from state: attempted, set goal, progressed
  // per step, completed, earned. Pass `only` to limit them to one lesson slug.
  //
  // An LRS refuses a resent id whose content differs (409), and one refusal
  // fails the whole batch. So a statement carries only what was true when its
  // event happened: no running percentages, and a changed goal is a new
  // statement rather than an edit to the start.
  function toStatements(state, site, digest, names, only) {
    var actor = { objectType: "Agent", account: { homePage: site.url, name: state.learner.uuid } };
    var drafts = [];
    function verb(key) {
      var d = {};
      d["en-US"] = key;
      return { id: VERB[key], display: d };
    }
    function activity(id, type, name) {
      var a = { objectType: "Activity", id: id };
      if (type || name) {
        a.definition = {};
        if (type) a.definition.type = type;
        if (name) a.definition.name = { "en-US": name };
      }
      return a;
    }
    function parent(l) {
      return l.level ? [{ id: site.url + "/paths/" + l.level + "/" }] : [];
    }

    Object.keys(state.lessons).forEach(function (slug) {
      if (only && slug !== only) return;
      var l = state.lessons[slug];
      var iri = lessonIri(site, slug);
      var obj = activity(iri, LESSON_TYPE, l.title);
      if (l.startedAt) {
        drafts.push({ key: [iri, l.startedAt], s: { actor: actor, verb: verb("attempted"), object: obj, context: { contextActivities: { parent: parent(l) } }, timestamp: l.startedAt } });
      }
      if (l.goal) {
        var goalCtx = { contextActivities: { parent: parent(l) }, extensions: {} };
        goalCtx.extensions[site.url + "/xapi/extensions/goal-due"] = l.goal.dueAt;
        goalCtx.extensions[site.url + "/xapi/extensions/goal-by"] = l.goal.by;
        drafts.push({ key: [iri, l.goal.setAt], s: { actor: actor, verb: { id: site.url + "/xapi/verbs/set-goal", display: { "en-US": "set goal" } }, object: obj, context: goalCtx, timestamp: l.goal.setAt } });
      }
      var order = Object.keys(l.steps).sort(function (x, y) { return l.steps[x].localeCompare(l.steps[y]); });
      order.forEach(function (k) {
        var step = iri + "#step-" + k;
        drafts.push({
          key: [step, l.steps[k]],
          s: {
            actor: actor,
            verb: verb("progressed"),
            object: activity(iri),
            context: {
              contextActivities: {
                parent: parent(l),
                other: [activity(step, site.url + "/xapi/activity-types/step")],
              },
            },
            timestamp: l.steps[k],
          },
        });
      });
      if (l.completedAt) {
        var done = { completion: true };
        if (l.completion) {
          done.extensions = {};
          done.extensions[site.url + "/xapi/extensions/step-modes"] = l.completion.modes;
          if (l.completion.duration) done.duration = l.completion.duration;
        }
        drafts.push({ key: [iri, l.completedAt], s: { actor: actor, verb: verb("completed"), object: obj, result: done, context: { contextActivities: { parent: parent(l) } }, timestamp: l.completedAt } });
      }
    });

    Object.keys(state.awards).forEach(function (id) {
      if (only && id !== "lesson-" + only) return;
      var a = state.awards[id];
      var iri = achievementIri(site, id);
      drafts.push({ key: [iri, a.awardedAt], s: { actor: actor, verb: verb("earned"), object: activity(iri, null, (names && names[id]) || id), timestamp: a.awardedAt } });
    });

    return Promise.all(
      drafts.map(function (d) {
        return statementId(digest, [actor.account.name, d.s.verb.id].concat(d.key)).then(function (id) {
          var s = { id: id };
          Object.keys(d.s).forEach(function (k) { s[k] = d.s[k]; });
          return s;
        });
      }),
    );
  }

  // Unsigned claims, one per award, citing their evidence. A later server
  // verifies these and issues signed Open Badges 3.0 credentials.
  function toClaims(state, site) {
    return Object.keys(state.awards).map(function (id) {
      var evidence = [];
      if (id.indexOf("lesson-") === 0) {
        var slug = id.slice(7);
        var l = state.lessons[slug];
        if (l) {
          Object.keys(l.steps).forEach(function (k) { evidence.push(lessonIri(site, slug) + "#step-" + k); });
          if (l.evidenceUrl) evidence.push(l.evidenceUrl);
        }
      }
      return { achievement: achievementIri(site, id), awardedAt: state.awards[id].awardedAt, evidence: evidence };
    });
  }

  return {
    SCHEMA: SCHEMA,
    empty: empty,
    normalize: normalize,
    migrate: migrate,
    sync: sync,
    tick: tick,
    tickStretch: tickStretch,
    start: start,
    setGoal: setGoal,
    goalFor: goalFor,
    presetDue: presetDue,
    total: total,
    doneCount: doneCount,
    nextStep: nextStep,
    counts: counts,
    evaluate: evaluate,
    merge: merge,
    toSummary: toSummary,
    toStatements: toStatements,
    toClaims: toClaims,
    duration: duration,
    statementId: statementId,
    lessonIri: lessonIri,
    achievementIri: achievementIri,
  };
});
