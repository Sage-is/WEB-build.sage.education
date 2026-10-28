// /catalog.json — the public lesson catalogue. A server the learner hands
// progress to (a self-hosted Sage, a later hub) fetches lesson content from
// here, the way an n8n instance fetches templates from api.n8n.io, so only
// ids and the learner's own progress ever travel in a link.
class Catalog {
  data() {
    return { layout: false, eleventyExcludeFromCollections: true, permalink: "/catalog.json" };
  }

  render({ site, lessons, badgeDocs, taxonomy }) {
    return JSON.stringify(
      {
        llr: 1,
        site: site.url,
        name: site.name,
        lessons: lessons.map((l) => {
          const id = `${site.url}/lessons/${l.slug}/`;
          return {
            id,
            slug: l.slug,
            title: l.overlay.title,
            summary: l.overlay.summary,
            level: l.overlay.level,
            timeEstimate: l.overlay.timeEstimate,
            goalDays: taxonomy.timeTargets[l.overlay.timeEstimate],
            sourceHash: l.overlay.sourceHash,
            steps: l.overlay.steps.map((s, i) => ({ id: `${id}#step-${i}`, title: s.title, label: s.label })),
            stretchGoals: (l.overlay.stretchGoals || []).length,
            achievement: `${site.url}/achievements/lesson-${l.slug}.json`,
          };
        }),
        achievements: badgeDocs.map((d) => d.body.id),
      },
      null,
      2,
    );
  }
}

module.exports = Catalog;
