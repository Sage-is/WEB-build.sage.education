module.exports = {
  levels: [
    {
      key: "beginner",
      label: "Beginner",
      sub: "one-sitting wins",
      intro:
        "Projects an AI agent can genuinely build in one sitting. You learn the full loop: describe, build, verify, own the result.",
    },
    {
      key: "intermediate",
      label: "Intermediate",
      sub: "weekend builds",
      intro:
        "Weekend-sized builds that need more than one shot. You learn to split a project into steps and decide what to do by hand, what to steer, and what to hand off.",
    },
    {
      key: "advanced",
      label: "Advanced",
      sub: "capstone projects",
      intro:
        "Capstones where the honest build is a consolation version of the paid product. You learn why the moat exists, and how far a personal build really goes.",
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
