// Open Badges 3.0 Achievement definitions, one per badge and one per lesson,
// published at /achievements/<id>.json. The URL is the achievement's IRI,
// which the xAPI "earned" statements and exported claims point at. These are
// definitions only: nothing here is a credential, and nothing is signed.
const site = require("./site.json");
const achievements = require("./achievements.js");
const lessons = require("./lessons.js");

const CONTEXT = [
  "https://www.w3.org/ns/credentials/v2",
  "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
];
const creator = { id: `${site.url}/`, type: ["Profile"], name: `Sage.Education · ${site.name}` };

function doc(id, name, description, narrative, achievementType) {
  return {
    "@context": CONTEXT,
    id: `${site.url}/achievements/${id}.json`,
    type: ["Achievement"],
    achievementType,
    name,
    description,
    criteria: { narrative },
    creator,
  };
}

module.exports = function () {
  const docs = achievements.map((a) => ({
    slug: a.id,
    body: doc(a.id, a.name, a.criteria, a.criteria, a.certificate ? "Certificate" : "Badge"),
  }));
  for (const l of lessons()) {
    const url = `${site.url}/lessons/${l.slug}/`;
    docs.push({
      slug: `lesson-${l.slug}`,
      body: doc(
        `lesson-${l.slug}`,
        l.overlay.title,
        l.overlay.summary,
        `Tick every step of the build at ${url}. Self-reported by the learner.`,
        "Certificate",
      ),
    });
  }
  return docs;
};
