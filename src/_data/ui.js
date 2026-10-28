// Shared startr.style prop strings, so every card, chip and panel on the
// site is one recipe. Use as style="{{ ui.card }}; --mb:1rem" and append
// any per-element props after it.
module.exports = {
  card: "--b:1px solid var(--c-line); --radius:0.5rem; --p:1rem",
  panel: "--bg:var(--c-panel); --radius:0.5rem; --p:1rem",
  chip: "--c:white; --p:0.1rem 0.5rem; --radius:0.3rem; --size:0.75rem; --weight:700",
  tag: "--p:0.15rem 0.6rem; --b:1px solid var(--c-line); --radius:0.3rem",
  h2: "--size:1.3rem; --weight:700; --mt:2rem; --mb:0.6rem",
  note: "--size:0.85rem",
  button: "--p:0.4rem 0.9rem",
};
