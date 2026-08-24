// Step progress, kept in your browser only. One localStorage key holds a map
// of lesson slug to the list of checked step indexes. No account, no server.
(function () {
  var KEY = "sage-build-progress";

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function save(progress) {
    localStorage.setItem(KEY, JSON.stringify(progress));
  }

  var boxes = document.querySelectorAll("input[data-step]");
  if (boxes.length === 0) return;

  var slug = boxes[0].getAttribute("data-step").split(":")[0];
  var progress = load();
  var checked = progress[slug] || [];

  function refresh() {
    var done = document.querySelectorAll("input[data-step]:checked").length;
    var counter = document.querySelector("[data-progress-counter]");
    if (counter) counter.textContent = "— " + done + " of " + boxes.length + " steps done";
    var builtIt = document.querySelector("[data-built-it]");
    if (builtIt) builtIt.hidden = done !== boxes.length;
  }

  boxes.forEach(function (box) {
    var index = Number(box.getAttribute("data-step").split(":")[1]);
    box.checked = checked.indexOf(index) !== -1;
    box.addEventListener("change", function () {
      var list = progress[slug] || [];
      if (box.checked) {
        if (list.indexOf(index) === -1) list.push(index);
      } else {
        list = list.filter(function (i) { return i !== index; });
      }
      progress[slug] = list;
      save(progress);
      refresh();
    });
  });

  refresh();

  // Copy buttons on step prompts.
  document.querySelectorAll("[data-copy-prompt]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var pre = btn.parentElement.querySelector("[data-prompt]");
      navigator.clipboard.writeText(pre.textContent).then(function () {
        btn.textContent = "copied";
        setTimeout(function () { btn.textContent = "copy prompt"; }, 1500);
      });
    });
  });
})();
