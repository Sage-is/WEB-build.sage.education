// Newsletter and "I built this" capture, backed by PocketBase. The base URL
// arrives via a meta tag at build time; without it this file does nothing and
// the page stays fully usable.
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

  var form = document.querySelector("[data-newsletter]");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var note = document.querySelector("[data-newsletter-note]");
      var email = form.email.value;
      post("build_newsletter", {
        email: email,
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
  }

  var btn = document.querySelector("[data-built-it-btn]");
  if (btn) {
    btn.addEventListener("click", function () {
      var note = document.querySelector("[data-built-it-note]");
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
  }
})();
