module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "./assets/": "/assets/" });

  // data/ lives one level above the project dir (src/) and is read at build
  // time by _data/lessons.js, so 11ty can't infer it as a dependency. Watch
  // it explicitly so overlay edits trigger a rebuild.
  eleventyConfig.addWatchTarget("../data");

  // App titles wrap before their bracketed subtitle, e.g.
  // "Build your own link-in-bio page" / "(a personal Linktree Pro)".
  // Escapes first, so pair with | safe at the call site.
  eleventyConfig.addFilter("titleBreak", (value) => {
    if (!value) return value;
    const escaped = String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return escaped.replace(/\s+\(/g, "<br>(");
  });

  eleventyConfig.addLayoutAlias("default", "default.njk");
  eleventyConfig.addLayoutAlias("lesson", "lesson.njk");
  eleventyConfig.addGlobalData("layout", "default");

  return {
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk",
  };
};
