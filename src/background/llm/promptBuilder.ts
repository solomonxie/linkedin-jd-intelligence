// Builds the single prompt that produces the entire AnalysisResult in one
// LLM call — job/company/role extraction, brief, role classification, and
// the weighted requirement tree, all from raw page text + resume text.
// See docs/DESIGN.md "Prompt/response contract" for the rationale.

import { ROLE_TAXONOMY } from "../../shared/roleTaxonomy";
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
    "applicantCount": Fact<number>
  },
  "roleClassification": { "normalizedRole": string, "rationale": string },
  "requirements": RequirementNode[],
  "summary": string
}
// Fact<T> = { "value": T | null, "source": "page" | "llm-estimate" }
// CompanyInfo = {
//   "domain": Fact<string>, "mainProducts": Fact<string[]>, "employeeSize": Fact<string>,
//   "engineeringSize": Fact<string>, "arr": Fact<string>, "fundingStage": Fact<string>,
//   "ownership": Fact<"public"|"private">, "techStack": Fact<string[]>
// }
// RequirementNode = {
//   "requirement": string, "tier": "must-have" | "nice-to-have" | "implied",
//   "weight": number,          // 0-100, importance relative to sibling nodes
//   "matched": boolean, "evidence": string | null, "resumeSnippet": string | null,
//   "children": RequirementNode[]   // [] if none
// }

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

REQUIREMENT TREE — WEIGHTED AND HIERARCHICAL, NOT A FLAT LIST
Group related sub-skills under a main skill/category as "children" instead of listing everything flat —
e.g. Django/FastAPI nested under "Python"; Kubernetes/Docker/microservices nested under "Container
system"; ClickHouse/Parquet nested under "Columnar DB". Assign every node (at every depth) a "weight"
(0-100) reflecting how central it is to the role, roughly comparable across its siblings — the caller
will renormalize these locally, so a rough relative signal is enough.

For each requirement the posting explicitly names, also add the skills it reasonably implies as
"implied" children even though the posting never names them — nesting itself communicates "this came
from its parent," so there is no separate pointer field. Examples of the kind of inference expected:
  - Django implies: Python, ORM experience, REST API design, web-app development
  - Postgres implies: relational-database design
  - ClickHouse implies: columnar/analytical-database experience
  - RabbitMQ implies: asynchronous/event-driven messaging
  - SQS implies: AWS
  - Spark implies: distributed data processing, likely a data-lake/Delta Lake context
"must-have" and "nice-to-have" are for what the posting states directly (required vs. preferred/bonus
language); "implied" is exclusively for skills you inferred rather than the posting naming.

MATCHING
For every node (every depth), set "matched": true if the resume shows explicit OR implied evidence for
it — e.g. a "Python" requirement is matched, with evidence noting the inference, if the resume only
lists "Django". Put a short quote or paraphrase in "evidence" and, if applicable, the relevant resume
fragment in "resumeSnippet". Leave both null if nothing in the resume supports it.

INPUTS

[RESUME]
${resumeText}
[END RESUME]

[JOB POSTING PAGE TEXT]
${rawPageText}
[END JOB POSTING PAGE TEXT]

Respond now with exactly one \`\`\`json ... \`\`\` code block matching the schema above.`;
}
