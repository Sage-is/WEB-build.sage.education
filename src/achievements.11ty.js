// /achievements/<id>.json — one Open Badges 3.0 Achievement per file, from
// _data/badgeDocs.js.
class Achievements {
  data() {
    return {
      layout: false,
      eleventyExcludeFromCollections: true,
      pagination: { data: "badgeDocs", size: 1, alias: "badge" },
      permalink: (data) => `/achievements/${data.badge.slug}.json`,
    };
  }

  render(data) {
    return JSON.stringify(data.badge.body, null, 2);
  }
}

module.exports = Achievements;
