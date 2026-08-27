module.exports = {
  levels: [
    {
      key: "beginner",
      label: "Beginner",
      sub: "one-sitting wins",
      intro:
        "Projects you, working with an AI agent, can build in one sitting. You learn the full loop: describe, build, verify, own the result.",
    },
    {
      key: "intermediate",
      label: "Intermediate",
      sub: "weekend builds",
      intro:
        "Weekend-sized projects that are a little more involved. Learn to split a project into steps and decide what to do by hand, what to steer, and what to hand off.",
    },
    {
      key: "advanced",
      label: "Advanced",
      sub: "capstone projects",
      intro:
        "Big projects where the real version is much bigger than what you can make alone. You learn why large-scale product is hard, and how far a simple version can go.",
    },
  ],
  labels: {
    WE: { display: "WE", color: "var(--c-we)" },
    MANUALLY: { display: "BY HAND", color: "var(--c-manually)" },
    DELEGATE: { display: "DELEGATE", color: "var(--c-delegate)" },
  },
  timeLabels: {
    "one-sitting": "one sitting",
    weekend: "a weekend",
    "multi-day": "multi-day",
    "multi-week": "multi-week",
    "not-solo": "not realistically solo",
  },
};
