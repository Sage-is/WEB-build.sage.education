module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "./assets/": "/assets/" });

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
