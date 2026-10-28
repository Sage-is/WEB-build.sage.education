// Newsletter and "I built this" capture, backed by PocketBase. The base URL
// arrives via a meta tag at build time; without it this file does nothing and
// the page stays fully usable.
//
// Listeners sit on the document so they survive Startr Swap replacing
// <main>. The newsletter form also carries data-swap-off, so Swap never
// turns it into a GET that would put the address in the URL.
(function () {
  var meta = document.querySelector('meta[name="pb-url"]');
  var base = meta && meta.content;
  if (!base) return;

  function post(collection, record) {
    return fetch(base + "/api/collections/" + collection + "/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
    });
  }

  document.addEventListener("submit", function (event) {
    var form = event.target.closest && event.target.closest("[data-newsletter]");
    if (!form) return;
    event.preventDefault();
    var note = form.parentElement.querySelector("[data-newsletter-note]");
    post("build_newsletter", {
      email: form.email.value,
      source_slug: form.getAttribute("data-source-slug") || "",
    })
      .then(function (res) {
        note.hidden = false;
        note.textContent = res.ok
          ? "You're in. Watch for the next lesson."
          : "That didn't go through — you may already be subscribed.";
        if (res.ok) form.hidden = true;
      })
      .catch(function () {
        note.hidden = false;
        note.textContent = "Couldn't reach the signup service. Try again later.";
      });
  });

  document.addEventListener("click", function (event) {
    var btn = event.target.closest && event.target.closest("[data-built-it-btn]");
    if (!btn) return;
    var note = btn.closest("[data-built-it]").querySelector("[data-built-it-note]");
    btn.disabled = true;
    post("build_completions", {
      slug: btn.getAttribute("data-slug"),
      level: btn.getAttribute("data-level"),
    })
      .then(function (res) {
        note.hidden = false;
        note.textContent = res.ok
          ? "Counted. Nice work."
          : "Couldn't record it, but the build is still yours.";
      })
      .catch(function () {
        btn.disabled = false;
        note.hidden = false;
        note.textContent = "Couldn't reach the server. Try again later.";
      });
  });
})();
