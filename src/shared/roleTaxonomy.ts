// Suggested (not enforced) labels for normalized role classification — job
// titles are frequently misleading, so the LLM classifies the role's actual
// function against this list with a free-form fallback.

export const ROLE_TAXONOMY = [
  "Software Engineer (Backend)",
  "Software Engineer (Frontend)",
  "Software Engineer (Full-Stack)",
  "Data Engineer",
  "Data Scientist",
  "Data Analyst",
  "ML Engineer",
  "MLOps Engineer",
  "DevOps / SRE Engineer",
  "Platform / Infrastructure Engineer",
  "Mobile Engineer",
  "QA / Test Engineer",
  "Security Engineer",
  "Engineering Manager",
] as const;

export type SuggestedRole = (typeof ROLE_TAXONOMY)[number];
