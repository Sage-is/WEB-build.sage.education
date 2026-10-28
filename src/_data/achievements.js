// Every badge and certificate the site can award, in one place. /progress/
// renders this list, the client evaluates it (inlined once as JSON), and
// /achievements/<id>.json publishes each entry as an Open Badges 3.0
// Achievement. Criteria are shown before anything is earned, and an award is
// never taken back.
//
// kind "path":    finish `count` lessons at `level`; comes with a certificate.
// kind "mode":    tick `count` steps labelled `label`, across any lessons.
// kind "stretch": tick `count` stretch goals, across any lessons.
// Finishing a single lesson is its own achievement, "lesson:<slug>", built
// from the lesson list rather than listed here.
module.exports = [
  {
    id: "path-beginner",
    version: 1,
    kind: "path",
    level: "beginner",
    count: 3,
    certificate: true,
    name: "Beginner path",
    criteria: "Finish 3 beginner builds.",
  },
  {
    id: "path-intermediate",
    version: 1,
    kind: "path",
    level: "intermediate",
    count: 3,
    certificate: true,
    name: "Intermediate path",
    criteria: "Finish 3 intermediate builds.",
  },
  {
    id: "path-advanced",
    version: 1,
    kind: "path",
    level: "advanced",
    count: 1,
    certificate: true,
    name: "Capstone",
    criteria: "Finish 1 advanced build.",
  },
  {
    id: "mode-manually",
    version: 1,
    kind: "mode",
    label: "MANUALLY",
    count: 5,
    name: "Keys in hand",
    criteria: "Tick off 5 BY HAND steps: the accounts, DNS and billing work only you should do.",
  },
  {
    id: "mode-we",
    version: 1,
    kind: "mode",
    label: "WE",
    count: 10,
    name: "Pair debugger",
    criteria: "Tick off 10 WE steps: build beside an agent, read the error, apply the fix.",
  },
  {
    id: "mode-delegate",
    version: 1,
    kind: "mode",
    label: "DELEGATE",
    count: 5,
    name: "Clear brief",
    criteria: "Tick off 5 DELEGATE steps: hand over a precise prompt, then review the draft.",
  },
  {
    id: "stretch",
    version: 1,
    kind: "stretch",
    count: 3,
    name: "Past the brief",
    criteria: "Finish 3 stretch goals, on any builds.",
  },
];
