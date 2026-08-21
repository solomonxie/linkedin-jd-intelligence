// Builds the single prompt that produces the entire AnalysisResult in one
// LLM call — job/company/role extraction, brief, role classification, and
// the weighted requirement tree, all from raw page text + resume text.
// See docs/DESIGN.md "Prompt/response contract" for the rationale.

import { ROLE_TAXONOMY } from "../../shared/roleTaxonomy";
import { formatIndustryPresetsForPrompt } from "./industryPresets";
import { formatSkillPresetsForPrompt } from "./skillPresets";
import type { CompanyInfo } from "../../shared/types";

export interface BuildPromptParams {
  resumeText: string;
  rawPageText: string;
  /** When set, company research is already known — skip re-deriving it (see CACHED COMPANY INFO below). */
  cachedCompanyInfo?: { name: string; info: CompanyInfo } | null;
}

export function buildAnalysisPrompt({ resumeText, rawPageText, cachedCompanyInfo }: BuildPromptParams): string {
  return `You are helping a job seeker evaluate a LinkedIn job posting against their resume.
You will be given the raw visible text of the job posting page and the candidate's resume text.
Extract structured information and respond with EXACTLY ONE fenced JSON code block (\`\`\`json ... \`\`\`)
matching the schema below. Do not include any text outside that one code block.

SCHEMA
{
  "jobTitle": string,
  "company": string,
  "location": string,
  "workplaceType": "remote" | "hybrid" | "onsite" | null,
  "companyInfo": CompanyInfo | null,
  "role": {
    "salaryRange": Fact<string>,
    "seniorHeadcount": Fact<string>,
    "applicantCount": Fact<number>,
    "applicantInsights": Fact<string>
  },
  "roleClassification": { "normalizedRole": string, "rationale": string },
  "requirements": RequirementNode[],
  "interviewRounds": InterviewRound[],
  "summary": string
}
// Fact<T> = { "value": T | null, "source": "page" | "llm-estimate" }
// CompanyInfo = {
//   "industry": Fact<string[]>, "mainProducts": Fact<string[]>, "employeeSize": Fact<string>,
//   "engineeringSize": Fact<string>, "arr": Fact<string>, "fundingStage": Fact<string>,
//   "ownership": Fact<"public"|"private">, "techStack": Fact<string[]>
// }
// RequirementNode = {
//   "requirement": string, "tier": "must-have" | "nice-to-have" | "implied",
//   "weight": number,          // 0-100, importance relative to sibling nodes
//   "matched": boolean, "evidence": string | null, "resumeSnippet": string | null,
//   "children": RequirementNode[]   // [] if none
// }
// InterviewRound = { "label": string, "durationMinutes": number | null, "mode": string | null, "source": "page" }

WORKPLACE TYPE
"workplaceType" is "remote" | "hybrid" | "onsite" — read it from an explicit workplace badge/label on the
posting (LinkedIn shows one directly) if present, otherwise infer from the description text (e.g. "work
from home", "fully remote" -> remote; "in-office", "on-site" -> onsite; a stated in-office schedule for
part of the week -> hybrid). Return null only if the posting gives no basis for any of the three.
${
  cachedCompanyInfo
    ? `
CACHED COMPANY INFO — ALREADY KNOWN, DO NOT RE-DERIVE
The company on this posting is already known to be "${cachedCompanyInfo.name}", and its companyInfo has
already been researched and cached. Set "companyInfo": null in your response instead of re-deriving it —
this is intentional, not a gap to fill. (Still set "company" in your response as normal from the posting.)
`
    : `
COMPANY INFO
Fill in "companyInfo" per the FACT-SOURCING RULES below.
`
}
FACT-SOURCING RULES (apply to every Fact<T> field within companyInfo and role)
- source: "page" means you found that value literally written in the job posting text below.
  Echo it back — do not invent or contradict what the page actually says.
- source: "llm-estimate" means you filled a gap using general knowledge about the company/role/market.
  Return value: null instead of a specific-sounding guess whenever you are not reasonably confident —
  this matters most for arr, fundingStage, engineeringSize, seniorHeadcount, and salaryRange when the
  posting doesn't show a number itself. A confident-looking wrong number is worse than null.
- EXCEPTION: role.applicantCount must NEVER be "llm-estimate". If the posting doesn't literally show an
  applicant count, return { "value": null, "source": "page" }. There is no reasonable way to estimate a
  specific applicant count from general knowledge, unlike ARR or headcount.
- EXCEPTION: role.applicantInsights must NEVER be "llm-estimate" either, for the same reason. This is
  LinkedIn's own "See how you compare to others who clicked apply" panel — applicant seniority-level
  and/or education-level percentage breakdowns, sometimes also a "candidates who clicked apply" count
  broken out by recency (distinct from the single applicantCount number above, which is the plain
  "X applicants" line near the job title, not this panel). Summarize what the panel states in one
  compact line, e.g. "52% Senior, 43% Entry, 1% Manager; education: 18% Bachelor's, 14% Master's, 11%
  Bachelor of Technology, 57% other". If the posting shows no such panel, return { "value": null,
  "source": "page" } — never estimate this from general knowledge about the company or role.

INDUSTRY (companyInfo.industry)
A company can belong to more than one industry/domain tag — return all that reasonably apply, e.g. a
venture capital firm is ["VC"], Google is ["Tech"], a university is ["Education"], Stripe is
["FinTech", "SaaS"]. Prefer one or more of these when they fit reasonably well, otherwise add a short
custom tag alongside them:
${formatIndustryPresetsForPrompt()}

ROLE CLASSIFICATION
Classify what the role actually IS from its responsibilities and requirements, not its literal title —
titles are frequently misleading (e.g. "Software Engineer, Data Platform" is often really Data
Engineering work). Prefer one of these labels when it fits reasonably well, otherwise use a short
custom label:
${ROLE_TAXONOMY.map((role) => `  - ${role}`).join("\n")}
Always include a one-sentence rationale for the classification.

REQUIREMENT TREE — SKILLS AND QUALIFICATIONS ONLY
Only include things a resume can actually provide evidence for or against: technical skills, tools,
domain knowledge, experience level, education, certifications. Do NOT add nodes for employment
logistics that aren't skills — employment type/schedule (full-time, part-time, contract), work
authorization or visa sponsorship, security clearance, relocation or travel willingness, and on-site/
hybrid/remote (already captured in "workplaceType" above) never belong in this tree, matched or not.
Do NOT add nodes for soft skills either — communication, collaboration, teamwork, leadership,
"stakeholder management," and similar are not resume-verifiable technical facts; leave them out even
if the posting lists them. Technical skills only.

Do NOT name a node after a generic, unfalsifiable catch-all either — "Software engineering", "Backend
development", "Programming", "Engineering experience" and similar are not things a resume can
specifically confirm or refute. A bullet that reads as generic experience often still bundles a concrete,
verifiable qualifier — years of experience, an industry/domain, a product type (B2B, B2C, SaaS, fintech,
healthcare, etc.) — extract THAT as its own node instead of folding it into (or dropping it in favor of)
the vague generic phrase.
  - "5+ years of software engineering experience shipping production code for B2B or B2C SaaS products"
    -> do NOT emit a bare "Software engineering" node; emit "5+ years of experience" (experience level)
    and "B2B/B2C SaaS product experience" (domain knowledge) — those are what a resume can actually show.

REQUIREMENT NAMING — BARE SKILL NAMES, ONE PER NODE
"requirement" is just the skill/tool/technology name itself (e.g. "TypeScript", "Docker", "AWS"), never
a sentence or phrase describing it. Strip wrapper language like "Experience with", "Proficiency in",
"Familiarity with", "Knowledge of" down to the skill name.

When one bullet names multiple skills that are ALL required together (e.g. "Experience with TypeScript
and Golang"), split them into separate sibling nodes at the bullet's own tier — one per skill, each
independently weighted and matched.
  - "Experience with TypeScript and Golang" -> two sibling nodes: "TypeScript", "Golang"

When one bullet offers a choice of ALTERNATIVES instead — any one of them satisfies it ("X, Y, Z, or
similar", "X, Y, or Z") — do NOT create separate top-level nodes for each option; that overstates the
bullet as needing all of them. Instead create ONE parent node named for the bullet's own category (or
its first option if there's no natural category name), at the bullet's own tier, with each alternative
as a child at THE SAME TIER as the parent — not "implied", since the posting named all of them itself.
  - "Strong proficiency in Python, Go, Java, C++, or similar" -> one must-have parent "Programming
    language" with must-have children "Python", "Go", "Java", "C++"
  - "Cloud platform expertise (AWS, GCP, or Azure)" -> one must-have parent "Cloud platform" with
    must-have children "AWS", "GCP", "Azure"

REQUIREMENT TREE — WEIGHTED AND HIERARCHICAL, NOT A FLAT LIST
Group related sub-skills under a main skill/category as "children" instead of listing everything flat —
e.g. Django/FastAPI nested under "Python" when the posting names both; Kubernetes/Docker nested under
"Container system"; ClickHouse/Parquet nested under "Columnar DB". Assign every node (at every depth) a
"weight" (0-100) reflecting how central it is to the role, roughly comparable across its siblings — the
caller will renormalize these locally, so a rough relative signal is enough.

TIER — "must-have"/"nice-to-have" COVER EVERYTHING THE POSTING NAMES; "implied" IS ONLY FOR YOUR OWN INFERENCES
A child node keeps its parent's tier (must-have/nice-to-have) whenever the posting itself names that
child — in a parenthetical, an "and"/"or" list, or spelled out elsewhere in the same bullet. Nesting a
node under a parent is about grouping related skills, never about demoting a posting-named skill to
"implied".
  - "...deep understanding of consistency, fault tolerance, state management" (spelled out by the
    posting) -> must-have children "Consistency", "Fault tolerance", "State management", NOT implied
  - "API design expertise (REST, gRPC)" -> must-have children "REST", "gRPC" under "API design", NOT implied
  - "Containerization and orchestration expertise (Kubernetes, Docker)" -> must-have children
    "Kubernetes", "Docker" — both are named by the posting, so neither is inferred

SKILL REFERENCE (grounding for the "implied" children below — not exhaustive; use judgment for anything
not listed here; "X(→Y,Z)" means X implies Y and Z)
${formatSkillPresetsForPrompt()}

"implied" is reserved for skills you add yourself that the posting never names anywhere. Use the SKILL
REFERENCE above plus your own judgment, applied only in the direction the posting's own words point:
  - A specific tool the posting names implies broader underlying skills it does NOT name, e.g. the
    posting says "Django" -> add implied children "Python", "ORM experience", "REST API design" (the
    posting never said these itself). Do NOT run this backwards: if the posting says "Python" alone,
    do not invent "Django"/"FastAPI"/other frameworks as implied children — the posting not naming a
    framework is not evidence the candidate needs one.
  - A generic/abstract phrase the posting uses INSTEAD OF naming specific tools implies the concrete
    tools commonly used for it, e.g. "containerization and orchestration experience" (no tools named)
    implies Docker and Kubernetes; "infrastructure as code" implies Terraform and Ansible; "CI/CD
    experience" implies common CI/CD tools (e.g. GitHub Actions, Jenkins). Keep the posting's own phrase
    as the node name in this case, and add the concrete tools as implied children of THAT bullet only —
    never borrow tools implied by one bullet (e.g. "infrastructure as code") to imply under a different,
    unrelated bullet (e.g. "developer-facing tooling (CLIs, SDKs, testing frameworks)") just because both
    are loosely "dev tooling."

DEDUPLICATION
If the same skill would otherwise appear twice — e.g. it's a natural implied child under one requirement
but the posting also names it directly elsewhere — give it one node, one consistent name, at the tier its
own explicit bullet states. Do not also add a second implied copy of it (under the same or a different
name) elsewhere in the tree.

COVERAGE
Every explicitly stated requirement and preferred/bonus qualification bullet must map to at least one
node, including years-of-experience and education/degree requirements (per the SKILLS AND QUALIFICATIONS
scope above). Do not silently drop bullets from either the required or the preferred/nice-to-have section.

MATCHING
For every node (every depth), set "matched": true if the resume shows explicit OR implied evidence for
it — e.g. a "Python" requirement is matched, with evidence noting the inference, if the resume only
lists "Django". Put a short quote or paraphrase in "evidence" and, if applicable, the relevant resume
fragment in "resumeSnippet". Leave both null if nothing in the resume supports it.

INTERVIEW ROUNDS
Only include a round if the posting explicitly describes its interview/hiring process (e.g. a numbered
list, a "Our process" section, "3 rounds: ..."). Do NOT guess or fill in a typical/expected process from
general knowledge — "source" must always be "page" here; if the posting doesn't describe its process,
return "interviewRounds": [] rather than inventing one. For each round found, "label" is a short name
(e.g. "Recruiter screen", "Technical interview", "System design", "Onsite", "Hiring manager chat"),
"durationMinutes" and "mode" (e.g. "virtual", "onsite", "phone") are whatever the posting states, or null
if not stated. Order rounds as the posting presents them.

INPUTS

[RESUME]
${resumeText}
[END RESUME]

[JOB POSTING PAGE TEXT]
${rawPageText}
[END JOB POSTING PAGE TEXT]

Respond now with exactly one \`\`\`json ... \`\`\` code block matching the schema above.`;
}
