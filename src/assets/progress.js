// Progress on build.sage.education, kept in this browser only. No account,
// no server. The rules live in progress-core.js; this file reads the page,
// stores state under localStorage "sage-build" and paints it back.
//
// Startr Swap replaces <main> in place, so nothing here binds to elements:
// every listener sits on the document, and render() repaints whatever page
// is in front, on load, after each swap, and when another tab writes.
(function () {
  var core = window.SageProgressCore;
  var KEY = "sage-build";
  var OLD_KEY = "sage-build-progress";
  var config = readJson("sage-progress-config") || { achievements: [], timeTargets: {}, levels: [], timeLabels: {}, site: "" };
  var levelNames = {};
  (config.levels || []).forEach(function (l) { levelNames[l.key] = l.label; });
  var site = { url: config.site, origin: location.origin };
  var digest = window.crypto && crypto.subtle ? crypto.subtle.digest.bind(crypto.subtle) : null;
  var state = load();
  var saved = true;
  var fresh = [];
  var resetSlug = "";
  var asked = false;

  function readJson(id) {
    var el = document.getElementById(id);
    try {
      return el ? JSON.parse(el.textContent) : null;
    } catch (e) {
      return null;
    }
  }

  function now() {
    return new Date().toISOString();
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return core.normalize(JSON.parse(raw));
      var old = localStorage.getItem(OLD_KEY);
      if (old) {
        var migrated = core.migrate(JSON.parse(old), now());
        localStorage.setItem(KEY, JSON.stringify(migrated));
        localStorage.removeItem(OLD_KEY);
        return migrated;
      }
    } catch (e) {
      // Private mode or corrupt data: start empty and say so on save.
    }
    return core.empty();
  }

  function save() {
    if (!state.learner.uuid && window.crypto && crypto.randomUUID) state.learner.uuid = crypto.randomUUID();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      saved = true;
    } catch (e) {
      saved = false;
    }
    // Ask once for storage the browser should not evict. Best effort: Safari
    // can still clear it after 7 days away, which is why backups exist.
    if (!asked && navigator.storage && navigator.storage.persist) {
      asked = true;
      navigator.storage.persist().catch(function () {});
    }
  }

  function names() {
    var out = {};
    config.achievements.forEach(function (a) { out[a.id] = a.name; });
    Object.keys(state.lessons).forEach(function (slug) {
      if (state.lessons[slug].title) out["lesson-" + slug] = state.lessons[slug].title;
    });
    return out;
  }

  // ── Small helpers ──────────────────────────────────────────────────────

  function all(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }
  function setText(sel, text, scope) {
    (scope || document).querySelectorAll(sel).forEach(function (n) { n.textContent = text; });
  }
  function show(sel, on, scope) {
    (scope || document).querySelectorAll(sel).forEach(function (n) { n.hidden = !on; });
  }
  function day(iso) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }
  function fullDay(iso) {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }
  function ago(iso) {
    var days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return days + " days ago";
  }
  function daysBetween(a, b) {
    return Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
  }
  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }
  function dateValue(iso) {
    var d = new Date(iso);
    var m = d.getMonth() + 1;
    var dd = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dd < 10 ? "0" : "") + dd;
  }

  // ── Messages (informational, never controlling) ────────────────────────

  function goalMessage(l) {
    var left = core.total(l) - core.doneCount(l);
    if (l.completedAt) {
      if (l.withinGoal === true) {
        var early = Math.floor((Date.parse(l.goal.dueAt) - Date.parse(l.completedAt)) / 86400000);
        return early >= 1
          ? "Finished within your goal, " + plural(early, "day") + " early. Well done."
          : "Finished within your goal. Well done.";
      }
      if (l.withinGoal === false && l.startedAt) {
        return "Finished in " + plural(daysBetween(l.startedAt, l.completedAt), "day") +
          "; your goal was " + daysBetween(l.startedAt, l.goal.dueAt) + ". Builds like this often run long.";
      }
      return "Finished " + day(l.completedAt) + ".";
    }
    if (!l.startedAt) return "";
    var bits = ["Started " + day(l.startedAt)];
    if (l.lastProgressAt) bits.push("last worked " + ago(l.lastProgressAt));
    if (l.goal) {
      if (Date.parse(l.goal.dueAt) < Date.now()) return bits.join(" · ") + ". Your goal date has passed. Pick a new one?";
      bits.push("goal " + day(l.goal.dueAt));
    }
    bits.push(plural(left, "step") + " left");
    return bits.join(" · ");
  }

  function modeCounts(l) {
    var c = { MANUALLY: 0, WE: 0, DELEGATE: 0 };
    l.labels.forEach(function (x) { if (c[x] !== undefined) c[x]++; });
    return c.MANUALLY + " BY HAND · " + c.WE + " WE · " + c.DELEGATE + " DELEGATE";
  }

  // ── Lesson page ────────────────────────────────────────────────────────

  function lessonMeta(article) {
    return {
      title: article.getAttribute("data-title"),
      level: article.getAttribute("data-level"),
      timeEstimate: article.getAttribute("data-time-estimate"),
      sourceHash: article.getAttribute("data-source-hash"),
      labels: all("input[data-step]").map(function (b) { return b.getAttribute("data-label"); }),
    };
  }

  function renderLesson(article) {
    var slug = article.getAttribute("data-lesson");
    var existed = !!state.lessons[slug];
    if (core.sync(state, slug, lessonMeta(article))) resetSlug = slug;
    if (existed) save();
    var l = state.lessons[slug];

    all("input[data-step]").forEach(function (box) {
      var i = box.getAttribute("data-step").split(":")[1];
      box.checked = !!l.steps[i];
      var card = box.closest("[data-step-card]");
      if (card) card.toggleAttribute("data-on", box.checked);
    });
    all("input[data-stretch]").forEach(function (box) {
      box.checked = !!l.stretch[box.getAttribute("data-stretch").split(":")[1]];
    });

    var done = core.doneCount(l);
    var total = core.total(l);
    var pct = total ? Math.round((done * 100) / total) : 0;
    all("[data-progress-bar]").forEach(function (bar) {
      bar.style.setProperty("--w", pct + "%");
      var track = bar.parentElement;
      track.setAttribute("aria-valuenow", String(pct));
      track.setAttribute("aria-valuetext", done + " of " + total + " steps done");
    });
    setText("[data-progress-counter]", done + " of " + total + " done");
    var next = core.nextStep(l);
    all("[data-progress-next]").forEach(function (a) {
      a.hidden = next === -1 || !!l.completedAt;
      if (next !== -1) {
        a.href = "#step-" + next;
        a.textContent = "next: step " + (next + 1);
      }
    });
    show("[data-progress-reset]", resetSlug === slug);
    show("[data-storage-warning]", !saved);

    // Goal strip.
    var days = config.timeTargets[l.timeEstimate] || 14;
    var started = !!l.startedAt;
    setText("[data-goal-text]", started
      ? goalMessage(l)
      : "Not started yet. Builds like this take " + (config.timeLabels[l.timeEstimate] || "a while") +
        ", so your goal will default to " + plural(days, "day") + " from the day you start. You can change it.");
    show("[data-start]", !started && !l.completedAt);
    show("[data-goal-controls]", started && !l.completedAt);
    all("[data-goal-date]").forEach(function (input) {
      if (l.goal && document.activeElement !== input) input.value = dateValue(l.goal.dueAt);
    });

    // Completion panel.
    all("[data-built-it]").forEach(function (panel) {
      panel.hidden = !l.completedAt;
      if (!l.completedAt) return;
      setText("[data-finished-date]", "Finished " + fullDay(l.completedAt) + ".", panel);
      setText("[data-goal-result]", goalMessage(l), panel);
      var badges = fresh
        .filter(function (id) { return id.indexOf("lesson-") !== 0; })
        .map(function (id) { return names()[id] || id; });
      setText("[data-new-awards]", badges.length ? "New: " + badges.join(", ") + "." : "", panel);
      panel.querySelectorAll("[data-reflection]").forEach(function (t) {
        if (document.activeElement !== t) t.value = l.reflection;
      });
      panel.querySelectorAll("[data-certificate-link]").forEach(function (a) {
        a.href = "/certificate/?lesson=" + encodeURIComponent(slug);
      });
    });
  }

  // ── Lists, nav and the progress page ───────────────────────────────────

  function renderChips() {
    all("[data-lesson-chip]").forEach(function (chip) {
      var l = state.lessons[chip.getAttribute("data-lesson-chip")];
      var done = l ? core.doneCount(l) : 0;
      if (l && l.completedAt) chip.textContent = "✓ done";
      else if (done) chip.textContent = done + "/" + core.total(l);
      else chip.textContent = "";
      chip.hidden = !chip.textContent;
      var card = chip.closest("[data-lesson-card]");
      if (card) card.toggleAttribute("data-on", !!(l && l.completedAt));
    });
    var finished = core.counts(state).finished;
    setText("[data-progress-count]", finished ? String(finished) : "");
    show("[data-progress-count]", finished > 0);
    // The header sits outside <main>, so a swap never re-renders it.
    all("a[data-nav]").forEach(function (a) {
      if (a.pathname === location.pathname) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function renderProgressPage(page) {
    all("[data-progress-row]").forEach(function (row) {
      var slug = row.getAttribute("data-progress-row");
      var l = state.lessons[slug];
      var status = "Not started";
      if (l && l.completedAt) status = "Finished " + day(l.completedAt);
      else if (l && l.startedAt) status = core.doneCount(l) + " of " + core.total(l) + " steps";
      setText("[data-row-status]", status, row);
      setText("[data-row-detail]", l && (l.startedAt || l.completedAt) ? goalMessage(l) : "", row);
      show("[data-row-cert]", !!(l && l.completedAt), row);
      row.toggleAttribute("data-on", !!(l && l.completedAt));
    });
    all("[data-award]").forEach(function (card) {
      var a = state.awards[card.getAttribute("data-award")];
      card.toggleAttribute("data-on", !!a);
      setText("[data-award-date]", a ? "Earned " + day(a.awardedAt) : "Not yet", card);
      show("[data-award-cert]", !!a, card);
    });
    all("[data-learner-name]").forEach(function (input) {
      if (document.activeElement !== input) input.value = state.learner.name;
    });
    show("[data-storage-warning]", !saved, page);
  }

  // ── Certificate page ───────────────────────────────────────────────────

  function renderCertificate(cert) {
    var q = new URLSearchParams(location.search);
    var slug = q.get("lesson") || "";
    var level = q.get("path") || "";
    var l = slug ? state.lessons[slug] : null;
    var award = level ? state.awards["path-" + level] : null;
    var earned = slug ? !!(l && l.completedAt) : !!award;

    show("[data-cert-missing]", !earned, cert);
    show("[data-cert-body]", earned, cert);
    show("[data-cert-evidence]", !!slug, cert);
    all("[data-learner-name]").forEach(function (input) {
      if (document.activeElement !== input) input.value = state.learner.name;
    });
    if (!earned) {
      var back = cert.querySelector("[data-cert-back]");
      if (back) back.href = slug ? "/lessons/" + encodeURIComponent(slug) + "/" : "/progress/";
      return;
    }

    setText("[data-cert-name]", state.learner.name || "Your name", cert);
    var lessons = cert.querySelector("[data-cert-lessons]");
    if (lessons) lessons.replaceChildren();
    var link = slug ? l.evidenceUrl : "";
    if (slug) {
      // "Build your own X (a personal Y)": the bracket gets its own line,
      // as titleBreak does on the lesson pages.
      var parts = /^(.*?)\s+(\(.*\))$/.exec(l.title) || [null, l.title, ""];
      setText("[data-cert-kind]", "finished the build", cert);
      setText("[data-cert-title]", parts[1], cert);
      setText("[data-cert-subtitle]", parts[2], cert);
      setText("[data-cert-level]", (levelNames[l.level] || l.level) + " · " + core.total(l) + " steps: " + modeCounts(l), cert);
      setText("[data-cert-dates]", (l.startedAt ? "Started " + fullDay(l.startedAt) + " · " : "") + "Finished " + fullDay(l.completedAt), cert);
      setText("[data-cert-goal]", l.withinGoal === true ? "Finished within the learner's own goal." : "", cert);
      all("[data-evidence-url]").forEach(function (input) {
        if (document.activeElement !== input) input.value = l.evidenceUrl;
      });
    } else {
      var label = levelNames[level] || level;
      setText("[data-cert-kind]", "completed the path", cert);
      setText("[data-cert-title]", label + " path", cert);
      setText("[data-cert-subtitle]", "", cert);
      var done = Object.keys(state.lessons)
        .filter(function (s) { return state.lessons[s].completedAt && state.lessons[s].level === level; })
        .sort(function (a, b) { return state.lessons[a].completedAt.localeCompare(state.lessons[b].completedAt); });
      setText("[data-cert-level]", plural(done.length, label.toLowerCase() + " build"), cert);
      setText("[data-cert-dates]", "Path completed " + fullDay(award.awardedAt), cert);
      setText("[data-cert-goal]", "", cert);
      done.forEach(function (s) {
        var x = state.lessons[s];
        var li = document.createElement("li");
        // No-break spaces keep a date on one line after a long title.
        li.textContent = x.title + " · " + fullDay(x.completedAt).replace(/ /g, " ") + (x.evidenceUrl ? " · " + x.evidenceUrl : "");
        if (lessons) lessons.appendChild(li);
      });
    }
    all("[data-cert-link]").forEach(function (n) {
      n.hidden = !link;
      n.textContent = link ? "Project: " + link : "";
    });
    var pledged = all("[data-pledge]").some(function (p) { return p.checked; });
    all("[data-print]").forEach(function (b) { b.disabled = !pledged; });
    setText("[data-cert-year]", String(new Date().getFullYear()), cert);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  function render() {
    var article = document.querySelector("[data-lesson]");
    if (article) renderLesson(article);
    renderChips();
    var page = document.querySelector("[data-progress-page]");
    if (page) renderProgressPage(page);
    var cert = document.querySelector("[data-certificate]");
    if (cert) renderCertificate(cert);
    if (window.SageLLR) window.SageLLR.render();
  }

  function changed() {
    fresh = fresh.concat(core.evaluate(state, config.achievements, now()));
    save();
    render();
  }

  // ── Backup ─────────────────────────────────────────────────────────────

  function exportFile() {
    var made = digest ? core.toStatements(state, site, digest, names()) : Promise.resolve([]);
    return made.then(function (statements) {
      var file = {
        llr: 1,
        kind: "export",
        src: location.origin,
        at: now(),
        state: state,
        statements: statements,
        claims: core.toClaims(state, site),
      };
      var blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "sage-build-progress-" + now().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
  }

  function importFile(file) {
    var note = document.querySelector("[data-import-status]");
    file.text().then(function (text) {
      var data = JSON.parse(text);
      var incoming = data && data.llr === 1 && data.kind === "export" ? data.state : data;
      state = core.merge(state, incoming);
      core.evaluate(state, config.achievements, now());
      save();
      render();
      if (note) note.textContent = "Imported. Your progress now includes that backup.";
    }).catch(function () {
      if (note) note.textContent = "That file is not a progress backup from this site.";
    });
  }

  // ── Events, all on the document ────────────────────────────────────────

  var armed = 0;

  document.addEventListener("change", function (e) {
    var t = e.target;
    var article = document.querySelector("[data-lesson]");
    var slug = article && article.getAttribute("data-lesson");
    if (t.matches("input[data-step]") && slug) {
      core.tick(state, slug, Number(t.getAttribute("data-step").split(":")[1]), t.checked, now(), config.timeTargets);
      changed();
    } else if (t.matches("input[data-stretch]") && slug) {
      core.tickStretch(state, slug, Number(t.getAttribute("data-stretch").split(":")[1]), t.checked, now());
      changed();
    } else if (t.matches("[data-goal-date]") && slug && t.value) {
      var p = t.value.split("-");
      var due = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 23, 59, 59, 999).toISOString();
      if (core.setGoal(state, slug, due, now())) changed();
    } else if (t.matches("[data-pledge]")) {
      render();
    } else if (t.matches("input[data-import]") && t.files && t.files[0]) {
      importFile(t.files[0]);
      t.value = "";
    }
  });

  document.addEventListener("input", function (e) {
    var t = e.target;
    var article = document.querySelector("[data-lesson]");
    var q = new URLSearchParams(location.search);
    var slug = (article && article.getAttribute("data-lesson")) || q.get("lesson");
    if (t.matches("[data-learner-name]")) {
      state.learner.name = t.value.slice(0, 120);
    } else if (t.matches("[data-reflection]") && slug && state.lessons[slug]) {
      state.lessons[slug].reflection = t.value.slice(0, 2000);
    } else if (t.matches("[data-evidence-url]") && slug && state.lessons[slug]) {
      var ok = core.normalize({ lessons: { x: { evidenceUrl: t.value.trim() } } }).lessons.x.evidenceUrl;
      t.setCustomValidity(t.value.trim() && !ok ? "Use a full https:// link" : "");
      state.lessons[slug].evidenceUrl = ok;
    } else {
      return;
    }
    save();
    var cert = document.querySelector("[data-certificate]");
    if (cert) renderCertificate(cert);
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-start], [data-goal-preset], [data-copy-prompt], [data-export], [data-reset], [data-print]");
    if (!t) return;
    var article = document.querySelector("[data-lesson]");
    var slug = article && article.getAttribute("data-lesson");
    if (t.matches("[data-start]") && slug) {
      core.start(state, slug, now(), config.timeTargets);
      changed();
    } else if (t.matches("[data-goal-preset]") && slug) {
      var due = core.presetDue(t.getAttribute("data-goal-preset"), now());
      if (due && core.setGoal(state, slug, due, now())) changed();
    } else if (t.matches("[data-copy-prompt]")) {
      var pre = t.parentElement.querySelector("[data-prompt]");
      navigator.clipboard.writeText(pre.textContent).then(function () {
        t.textContent = "copied";
        setTimeout(function () { t.textContent = "copy prompt"; }, 1500);
      });
    } else if (t.matches("[data-export]")) {
      exportFile();
    } else if (t.matches("[data-reset]")) {
      // Two clicks within five seconds, so no browser dialog is needed.
      if (Date.now() - armed < 5000) {
        state = core.empty();
        save();
        armed = 0;
        t.textContent = "Erase all progress on this site";
        render();
      } else {
        armed = Date.now();
        t.textContent = "Click again to erase everything";
      }
    } else if (t.matches("[data-print]") && !t.disabled) {
      window.print();
    }
  });

  document.addEventListener("swap:after", function () {
    fresh = [];
    resetSlug = "";
    render();
    window.scrollTo(0, 0);
    var h1 = document.querySelector("main h1");
    if (h1) {
      h1.setAttribute("tabindex", "-1");
      h1.focus({ preventScroll: true });
    }
  });

  window.addEventListener("storage", function (e) {
    if (e.key !== KEY && e.key !== null) return;
    state = load();
    render();
  });

  if (window.SageLLR) {
    window.SageLLR.provide({
      summary: function () {
        return core.toSummary(state, site, names());
      },
      statements: function (slug) {
        return digest ? core.toStatements(state, site, digest, names(), slug || undefined) : [];
      },
    });
  }

  // Awards a migrated or imported state already qualifies for are recorded
  // quietly; only what the learner earns on this page is announced.
  if (core.evaluate(state, config.achievements, now()).length) save();
  render();
})();
