module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "./assets/": "/assets/" });

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
