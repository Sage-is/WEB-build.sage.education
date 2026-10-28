// LLR/1 registry: the learning sites that may hand progress to each other.
// A payload is accepted only when it names a registered origin as its source
// and the browser's referrer agrees. See docs/llr-1.md.
//
//   receives  the site runs llr.js and its head snippet, so links to it
//             carry a summary (#llr=…). Off until a site adopts LLR/1, so
//             no raw fragment ever lands in a site that cannot lift it.
//   exports   the site serves /llr/export/, so other sites may pull from it.
//
// LLR_DEV=1 swaps this site's production origin for local test origins: the
// site on :8080 and a receiver fixture on :8081. :8082 stays unregistered
// as the outsider. Activity IRIs never change with the host; they come from
// site.url.
const PRODUCTION = [
  { origin: "https://sage.education", name: "Sage.Education", receives: false, exports: false },
  { origin: "https://build.sage.education", name: "Build it yourself", receives: true, exports: true },
  { origin: "https://docs.sage.education", name: "Sage.Education docs", receives: false, exports: false },
];

const DEV = [
  { origin: "https://sage.education", name: "Sage.Education", receives: false, exports: false },
  { origin: "http://localhost:8080", name: "Build it yourself (local)", receives: true, exports: true },
  { origin: "http://localhost:8081", name: "Receiver fixture (local)", receives: true, exports: false },
];

module.exports = { version: 1, sites: process.env.LLR_DEV === "1" ? DEV : PRODUCTION };
