module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "./assets/": "/assets/" });
  // LLR/1 client, pinned by major version so other sites can load it with
  // SRI. Same bytes as /assets/llr.js; see docs/llr-1.md.
  eleventyConfig.addPassthroughCopy({ "./assets/llr.js": "/llr/v1/llr.js" });
  eleventyConfig.addPassthroughCopy({ "./_headers": "/_headers" });

  // data/ lives one level above the project dir (src/) and is read at build
  // time by _data/lessons.js, so 11ty can't infer it as a dependency. Watch
  // it explicitly so overlay edits trigger a rebuild.
  eleventyConfig.addWatchTarget("../data");

  // App titles set their bracketed subtitle on its own smaller line, e.g.
  // "Build your own link-in-bio page" / "(a personal Linktree Pro)".
  // Escapes first, so pair with | safe at the call site.
  eleventyConfig.addFilter("titleBreak", (value) => {
    if (!value) return value;
    const escaped = String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return escaped.replace(
      /\s+(\(.*\))\s*$/,
      '<span style="--d:block; --size:0.62em; --weight:400; --mt:0.2rem">$1</span>',
    );
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
