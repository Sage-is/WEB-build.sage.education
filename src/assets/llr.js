/*!
 * LLR/1 — Local Learning Record handoff between our learning sites.
 * Spec: docs/llr-1.md in Sage-is/WEB-build.sage.education. AGPL-3.0.
 *
 * Progress lives in each site's own browser storage. It moves to another
 * site only when the learner does, as a URL fragment (#llr=1.<payload>)
 * that never reaches a server. The pattern is n8n's "your servers": a
 * destination announces itself by link, the source remembers it, and every
 * handoff is a plain top-level navigation, so it behaves the same in every
 * browser, Safari included.
 *
 * PAGE CONTRACT
 *   <script type="application/json" id="llr-registry">{ "sites": [{ "origin", "name", "receives", "exports" }] }</script>
 *     the sites this page accepts progress from; links carry a summary only to
 *     sites that receive, and pull buttons appear only for sites that export
 *   the inline <head> snippet (docs/llr-1.md) that lifts #llr= and
 *     ?sage_server= off the address bar before anything else runs
 *   a[data-llr]           link to a registered site: carries this site's summary
 *   [data-llr-widget]     "continue where you left off", from this site and snapshots;
 *                         ="quiet" hides its [data-llr-section] while empty
 *   [data-llr-servers]    the learner's Sage servers, each with Remove
 *   [data-llr-send]       data-slug: "Send progress to your Sage" buttons
 *   [data-llr-export]     the pull endpoint: send the learner back to ?return=
 *
 * A host site describes its own progress with SageLLR.provide({ summary,
 * statements }). Without a provider, the page still receives and shows
 * other sites' snapshots.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.SageLLR = api;
    api.boot();
  }
})(typeof self !== "undefined" ? self : this, function () {
  var VERSION = 1;
  var MAX_FRAGMENT = 65536;
  var MAX_JSON = 262144;
  var SNAPSHOTS = "llr-snapshots";
  var SERVERS = "sage-servers";

  // ── Encoding: JSON, deflate-raw, base64url ─────────────────────────────

  function b64url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function unb64url(text) {
    var bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // A corrupt input fails on the readable side, which the caller handles.
  // The writer's own promises reject too; swallow those so the failure is
  // reported once, not again as an unhandled rejection.
  function pipe(bytes, stream) {
    var writer = stream.writable.getWriter();
    writer.write(bytes).catch(function () {});
    writer.close().catch(function () {});
    return new Response(stream.readable).arrayBuffer().then(function (buf) {
      return new Uint8Array(buf);
    });
  }

  function encode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    return pipe(bytes, new CompressionStream("deflate-raw")).then(function (packed) {
      return VERSION + "." + b64url(packed);
    });
  }

  // Resolves to the object, or null for anything malformed or oversized.
  function decode(text) {
    if (typeof text !== "string" || text.length > MAX_FRAGMENT) return Promise.resolve(null);
    var m = /^1\.([A-Za-z0-9_-]+)$/.exec(text);
    if (!m) return Promise.resolve(null);
    var packed;
    try {
      packed = unb64url(m[1]);
    } catch (e) {
      return Promise.resolve(null);
    }
    return pipe(packed, new DecompressionStream("deflate-raw"))
      .then(function (bytes) {
        if (bytes.length > MAX_JSON) return null;
        return JSON.parse(new TextDecoder().decode(bytes));
      })
      .catch(function () {
        return null;
      });
  }

  // ── Trust checks ───────────────────────────────────────────────────────

  function originOf(url) {
    try {
      var u = new URL(url);
      return u.protocol === "https:" || u.protocol === "http:" ? u.origin : "";
    } catch (e) {
      return "";
    }
  }

  function siteFor(origin, registry) {
    var sites = (registry && registry.sites) || [];
    for (var i = 0; i < sites.length; i++) if (sites[i].origin === origin) return sites[i];
    return null;
  }

  function str(v, max) {
    return typeof v === "string" ? v.slice(0, max) : "";
  }
  function iso(v) {
    return typeof v === "string" && v && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : "";
  }
  function count(v) {
    return Number.isInteger(v) && v >= 0 && v <= 100 ? v : 0;
  }
  function onOrigin(url, origin) {
    return originOf(url) === origin ? new URL(url).href : "";
  }

  // Keep only the summary fields, with links confined to the source origin.
  function cleanSummary(body, src) {
    var courses = [];
    var awards = [];
    if (body && Array.isArray(body.courses)) {
      body.courses.slice(0, 100).forEach(function (c) {
        if (!c || typeof c !== "object") return;
        var url = onOrigin(c.url, src);
        if (!url || !str(c.title, 200)) return;
        courses.push({
          id: originOf(c.id) ? str(c.id, 500) : "",
          title: str(c.title, 200),
          url: url,
          done: count(c.done),
          total: count(c.total),
          resumeUrl: onOrigin(c.resumeUrl, src) || url,
          startedAt: iso(c.startedAt),
          lastProgressAt: iso(c.lastProgressAt),
          dueAt: iso(c.dueAt),
          completedAt: iso(c.completedAt),
          withinGoal: typeof c.withinGoal === "boolean" ? c.withinGoal : null,
        });
      });
    }
    if (body && Array.isArray(body.awards)) {
      body.awards.slice(0, 200).forEach(function (a) {
        if (!a || typeof a !== "object" || !originOf(a.id) || !iso(a.awardedAt)) return;
        awards.push({ id: str(a.id, 500), name: str(a.name, 200), awardedAt: iso(a.awardedAt) });
      });
    }
    return { courses: courses, awards: awards };
  }

  // A summary is kept only when it names a registered source that is not
  // this page, and the browser's referrer agrees about where it came from.
  // A crafted link from anywhere else is dropped without a word.
  function accept(payload, referrer, registry, self) {
    if (!payload || payload.llr !== VERSION || payload.kind !== "summary") return null;
    var src = typeof payload.src === "string" ? payload.src : "";
    var site = siteFor(src, registry);
    if (!site || src === self || originOf(referrer) !== src || !iso(payload.at)) return null;
    return { src: src, name: str(site.name, 120), at: iso(payload.at), summary: cleanSummary(payload.body, src) };
  }

  // Where the pull endpoint may send the learner back to: a registered
  // site, or a Sage server the learner confirmed. Nothing else.
  function allowedReturn(url, registry, servers) {
    var origin = originOf(url);
    if (!origin) return "";
    if (siteFor(origin, registry)) return new URL(url).href;
    for (var i = 0; i < (servers || []).length; i++) {
      if (originOf(servers[i].base) === origin) return new URL(url).href;
    }
    return "";
  }

  // ?sage_server=<base URL>&sage_caps=a,b — a self-hosted Sage introducing
  // itself. The base keeps its path, so a server under /sage/ works.
  function parseServer(server, caps) {
    var origin = originOf(server);
    if (!origin) return null;
    var u = new URL(server);
    var base = origin + u.pathname.replace(/\/?$/, "/");
    var list = String(caps || "")
      .split(",")
      .map(function (c) { return c.trim(); })
      .filter(function (c) { return /^[a-z0-9-]{1,40}$/.test(c); })
      .slice(0, 20);
    return { base: base, caps: list };
  }

  function importUrl(base) {
    return base + "learn/import";
  }

  // ── Browser ────────────────────────────────────────────────────────────

  var registry = null;
  var provider = null;
  var outgoing = "";

  function read(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadRegistry() {
    var el = document.getElementById("llr-registry");
    try {
      registry = el ? JSON.parse(el.textContent) : { sites: [] };
    } catch (e) {
      registry = { sites: [] };
    }
  }

  function servers() {
    var list = read(SERVERS, []);
    return Array.isArray(list)
      ? list.filter(function (s) { return s && originOf(s.base) && Array.isArray(s.caps); })
      : [];
  }

  function snapshots() {
    var all = read(SNAPSHOTS, {});
    return all && typeof all === "object" ? all : {};
  }

  function ownSummary() {
    if (!provider || !provider.summary) return Promise.resolve({ courses: [], awards: [] });
    return Promise.resolve(provider.summary());
  }

  // Precompute the outgoing payload so decorating a link at click time
  // stays synchronous.
  function refreshOutgoing() {
    return ownSummary()
      .then(function (summary) {
        return encode({ llr: VERSION, src: location.origin, kind: "summary", at: new Date().toISOString(), body: summary });
      })
      .then(function (text) {
        outgoing = text;
        return text;
      });
  }

  function receive() {
    var incoming = window.__llrIncoming;
    window.__llrIncoming = null;
    if (!incoming) return Promise.resolve();
    return decode(incoming.payload).then(function (payload) {
      var snap = accept(payload, incoming.referrer, registry, location.origin);
      if (!snap) return;
      var all = snapshots();
      all[snap.src] = { name: snap.name, at: snap.at, receivedAt: new Date().toISOString(), summary: snap.summary };
      write(SNAPSHOTS, all);
    });
  }

  function decorate(e) {
    var a = e.target && e.target.closest && e.target.closest("a[data-llr]");
    if (!a || !outgoing) return;
    var url;
    try {
      url = new URL(a.getAttribute("data-llr-href") || a.href, location.href);
    } catch (err) {
      return;
    }
    var site = siteFor(url.origin, registry);
    if (url.origin === location.origin || !site || !site.receives) return;
    if (!a.hasAttribute("data-llr-href")) a.setAttribute("data-llr-href", url.href);
    url.hash = "";
    a.href = url.href + "#llr=" + outgoing;
  }

  // ── Rendering: inert text only, styled with startr.style props ─────────

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute("style", style);
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function day(isoText) {
    return new Date(isoText).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }

  function ago(isoText) {
    var days = Math.floor((Date.now() - Date.parse(isoText)) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return days + " days ago";
  }

  function line(course, site) {
    var li = el("li", "--b:1px solid var(--c-line); --radius:0.5rem; --p:0.6rem 0.8rem");
    var a = el("a", "--weight:700", "Continue: " + course.title);
    a.href = course.resumeUrl;
    if (site) a.setAttribute("data-llr", "");
    li.appendChild(a);
    var bits = [course.done + " of " + course.total + " steps"];
    if (course.dueAt) bits.push(Date.parse(course.dueAt) < Date.now() ? "goal date passed" : "goal " + day(course.dueAt));
    if (course.lastProgressAt) bits.push("last worked " + ago(course.lastProgressAt));
    if (site) bits.push("on " + site.name + ", as of " + ago(site.at));
    li.appendChild(el("p", "--size:0.8rem; --m:0.2rem 0 0", bits.join(" · ")));
    return li;
  }

  function renderWidgets(own) {
    var nodes = document.querySelectorAll("[data-llr-widget]");
    if (!nodes.length) return;
    var snaps = snapshots();
    Array.prototype.forEach.call(nodes, function (node) {
      node.replaceChildren();
      var list = el("ul", "--lis:none; --p:0; --m:0; --d:grid; --g:0.5rem");
      own.courses
        .filter(function (c) { return !c.completedAt && c.done < c.total; })
        .slice(0, 3)
        .forEach(function (c) { list.appendChild(line(c, null)); });
      Object.keys(snaps).forEach(function (origin) {
        if (origin === location.origin || !siteFor(origin, registry)) return;
        var snap = snaps[origin];
        var summary = cleanSummary(snap.summary, origin);
        summary.courses
          .filter(function (c) { return !c.completedAt && c.done < c.total; })
          .slice(0, 3)
          .forEach(function (c) { list.appendChild(line(c, { name: snap.name, at: snap.at })); });
      });
      // data-llr-widget="quiet" hides its [data-llr-section] while there is
      // nothing to continue, so a first visit shows no empty box.
      var quiet = node.getAttribute("data-llr-widget") === "quiet";
      var section = node.closest("[data-llr-section]");
      if (section) section.hidden = quiet && !list.children.length;
      if (list.children.length) node.appendChild(list);
      else if (quiet) return;
      else node.appendChild(el("p", "--size:0.9rem; --m:0", "No builds in progress. Pick one and tick off a step to see it here."));

      // Pull buttons for the other registered sites.
      var pulls = el("p", "--size:0.8rem; --m:0.6rem 0 0; --d:flex; --g:0.8rem; --fw:wrap");
      registry.sites.forEach(function (s) {
        if (s.origin === location.origin || !s.exports) return;
        var back = location.origin + location.pathname;
        var a = el("a", "", "Refresh from " + s.name);
        a.href = s.origin + "/llr/export/?return=" + encodeURIComponent(back);
        a.setAttribute("data-llr", "");
        pulls.appendChild(a);
      });
      if (pulls.children.length) node.appendChild(pulls);
    });
  }

  function renderServers() {
    var list = servers();
    Array.prototype.forEach.call(document.querySelectorAll("[data-llr-servers]"), function (node) {
      node.replaceChildren();
      if (!list.length) {
        node.appendChild(el("p", "--size:0.85rem; --m:0", "None yet. A self-hosted Sage adds itself here when you follow its Learn link."));
        return;
      }
      var ul = el("ul", "--lis:none; --p:0; --m:0; --d:grid; --g:0.4rem");
      list.forEach(function (s) {
        var li = el("li", "--d:flex; --g:0.6rem; --ai:center; --fw:wrap");
        li.appendChild(el("code", "", s.base));
        li.appendChild(el("span", "--size:0.8rem", s.caps.length ? s.caps.join(", ") : "no capabilities"));
        var rm = el("button", "--p:0.2rem 0.6rem; --size:0.8rem", "Remove");
        rm.type = "button";
        rm.setAttribute("data-llr-remove", s.base);
        li.appendChild(rm);
        ul.appendChild(li);
      });
      node.appendChild(ul);
    });
  }

  function renderSend() {
    var capable = servers().filter(function (s) { return s.caps.indexOf("llr-import") !== -1; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-llr-send]"), function (node) {
      node.replaceChildren();
      node.hidden = !capable.length;
      capable.forEach(function (s) {
        var b = el("button", "--p:0.4rem 0.9rem", "Send progress to " + new URL(s.base).host);
        b.type = "button";
        b.setAttribute("data-llr-send-to", s.base);
        node.appendChild(b);
      });
    });
  }

  function banner(announce) {
    var main = document.querySelector("main");
    if (!main || document.querySelector("[data-llr-banner]")) return;
    var box = el("section", "--b:2px solid var(--c-we); --radius:0.5rem; --p:1rem; --mb:1rem");
    box.setAttribute("data-llr-banner", "");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Add a Sage server");
    box.appendChild(el("p", "--m:0 0 0.4rem; --weight:700", "Add " + announce.base + " to your Sage servers?"));
    box.appendChild(el("p", "--size:0.85rem; --m:0 0 0.6rem", "This browser will remember it. Lessons can then send your progress there, only when you click."));
    var row = el("p", "--d:flex; --g:0.6rem; --m:0");
    var add = el("button", "--p:0.4rem 0.9rem", "Add");
    add.type = "button";
    add.setAttribute("data-llr-server-add", "");
    var no = el("button", "--p:0.4rem 0.9rem", "Ignore");
    no.type = "button";
    no.setAttribute("data-llr-server-ignore", "");
    row.appendChild(add);
    row.appendChild(no);
    box.appendChild(row);
    box.__announce = announce;
    main.insertBefore(box, main.firstChild);
  }

  function exportPage() {
    var node = document.querySelector("[data-llr-export]");
    if (!node) return;
    var target = new URLSearchParams(location.search).get("return") || "";
    var back = allowedReturn(target, registry, servers());
    var status = node.querySelector("[data-llr-export-status]") || node;
    if (!back) {
      status.textContent = "That return address is not one of our learning sites or your Sage servers, so nothing was sent.";
      return;
    }
    status.textContent = "Sending your progress back…";
    refreshOutgoing().then(function (text) {
      var u = new URL(back);
      u.hash = "";
      location.replace(u.href + "#llr=" + text);
    });
  }

  function render() {
    if (!registry) return Promise.resolve();
    return ownSummary().then(function (own) {
      renderWidgets(own);
      renderServers();
      renderSend();
      return refreshOutgoing();
    });
  }

  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var add = t.closest("[data-llr-server-add]");
    var ignore = t.closest("[data-llr-server-ignore]");
    var remove = t.closest("[data-llr-remove]");
    var send = t.closest("[data-llr-send-to]");
    if (add || ignore) {
      var box = t.closest("[data-llr-banner]");
      if (add && box && box.__announce) {
        var list = servers().filter(function (s) { return s.base !== box.__announce.base; });
        list.push({ base: box.__announce.base, caps: box.__announce.caps, addedAt: new Date().toISOString() });
        write(SERVERS, list);
      }
      if (box) box.remove();
      render();
    } else if (remove) {
      var base = remove.getAttribute("data-llr-remove");
      write(SERVERS, servers().filter(function (s) { return s.base !== base; }));
      render();
    } else if (send && provider && provider.statements) {
      var slug = (send.closest("[data-llr-send]") || send).getAttribute("data-slug") || "";
      var tab = window.open("about:blank", "_blank");
      Promise.resolve(provider.statements(slug))
        .then(function (statements) {
          return encode({ llr: VERSION, src: location.origin, kind: "statements", at: new Date().toISOString(), body: { statements: statements } });
        })
        .then(function (text) {
          var url = importUrl(send.getAttribute("data-llr-send-to")) + "#llr=" + text;
          if (tab) {
            tab.opener = null;
            tab.location.href = url;
          } else location.href = url;
        });
    }
  }

  var booted = false;
  function start() {
    if (booted) return;
    booted = true;
    loadRegistry();
    if (window.__llrServer) {
      var announce = parseServer(window.__llrServer.server, window.__llrServer.caps);
      window.__llrServer = null;
      if (announce) banner(announce);
    }
    receive().then(function () {
      exportPage();
      return render();
    });
    document.addEventListener("click", decorate, true);
    document.addEventListener("auxclick", decorate, true);
    document.addEventListener("click", onClick);
    document.addEventListener("swap:after", function () { render(); });
    // A real handoff always loads a new document, where the head snippet
    // takes it. A #llr= that arrives as a same-document hash change has no
    // source we can check, so it is lifted off the address bar and ignored.
    window.addEventListener("hashchange", function () {
      if (location.hash.indexOf("#llr=") !== 0) return;
      history.replaceState(history.state, "", location.pathname + location.search);
    });
    window.addEventListener("storage", function (e) {
      if (e.key === SNAPSHOTS || e.key === SERVERS || e.key === null) render();
    });
  }

  function boot() {
    if (typeof document === "undefined") return;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }

  return {
    VERSION: VERSION,
    encode: encode,
    decode: decode,
    accept: accept,
    cleanSummary: cleanSummary,
    allowedReturn: allowedReturn,
    parseServer: parseServer,
    importUrl: importUrl,
    siteFor: siteFor,
    boot: boot,
    provide: function (p) {
      provider = p;
      if (booted) render();
    },
    render: render,
  };
});
