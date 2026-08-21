// Curated reference of common company industry/domain tags, given to the
// model as grounding for companyInfo.industry — not exhaustive, the model
// still uses judgment for anything not listed here. A company can belong to
// more than one (e.g. Stripe -> FinTech, SaaS; Coursera -> EdTech, SaaS).

export const INDUSTRY_PRESETS: string[] = [
  "Tech",
  "SaaS",
  "Enterprise Software",
  "Consumer",
  "Hardware",
  "FinTech",
  "VC",
  "Private Equity",
  "Insurance",
  "Healthcare",
  "HealthTech",
  "Biotech",
  "Pharma",
  "Education",
  "EdTech",
  "E-commerce",
  "Retail",
  "AdTech",
  "MarTech",
  "Gaming",
  "Media & Entertainment",
  "Cybersecurity",
  "Real Estate",
  "PropTech",
  "Legal",
  "LegalTech",
  "Logistics & Supply Chain",
  "Manufacturing",
  "Automotive",
  "Aerospace & Defense",
  "Energy",
  "CleanTech",
  "Agriculture",
  "Telecommunications",
  "Travel & Hospitality",
  "Food & Beverage",
  "Consulting",
  "Government",
  "Non-profit",
];

export function formatIndustryPresetsForPrompt(): string {
  return INDUSTRY_PRESETS.join(", ");
}
