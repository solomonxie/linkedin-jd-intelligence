import { describe, expect, it } from "vitest";
import { buildExtractionPrompt, buildRequirementsPrompt } from "./promptBuilder";
import { blankCompanyInfo } from "../../shared/types";

describe("buildExtractionPrompt", () => {
  it("doesn't include the resume, or the requirement tree's rules/skill reference", () => {
    const prompt = buildExtractionPrompt({ rawPageText: "JD TEXT MARKER" });
    expect(prompt).toContain("JD TEXT MARKER");
    expect(prompt).not.toContain("[RESUME]");
    expect(prompt).not.toContain("SKILL REFERENCE");
    expect(prompt).not.toContain("REQUIREMENT TREE");
  });

  it("includes the COMPANY INFO/INDUSTRY/HEADQUARTERS sections when nothing is cached", () => {
    const prompt = buildExtractionPrompt({ rawPageText: "x" });
    expect(prompt).toContain("COMPANY INFO\n");
    expect(prompt).toContain("INDUSTRY (companyInfo.industry)");
    expect(prompt).toContain("HEADQUARTERS (companyInfo.headquarters)");
  });

  it("skips the INDUSTRY/HEADQUARTERS sections and points at the cache when companyInfo is already known", () => {
    const prompt = buildExtractionPrompt({
      rawPageText: "x",
      cachedCompanyInfo: { name: "Acme Corp", info: blankCompanyInfo() },
    });
    expect(prompt).toContain("CACHED COMPANY INFO");
    expect(prompt).toContain("Acme Corp");
    expect(prompt).not.toContain("INDUSTRY (companyInfo.industry)");
    expect(prompt).not.toContain("HEADQUARTERS (companyInfo.headquarters)");
  });
});

describe("buildRequirementsPrompt", () => {
  it("includes both the resume and the JD text, plus the requirement tree rules and skill reference", () => {
    const prompt = buildRequirementsPrompt({ resumeText: "RESUME TEXT MARKER", rawPageText: "JD TEXT MARKER" });
    expect(prompt).toContain("RESUME TEXT MARKER");
    expect(prompt).toContain("JD TEXT MARKER");
    expect(prompt).toContain("SKILL REFERENCE");
    expect(prompt).toContain("REQUIREMENT TREE");
  });

  it("doesn't include the company/role extraction instructions", () => {
    const prompt = buildRequirementsPrompt({ resumeText: "x", rawPageText: "x" });
    expect(prompt).not.toContain("COMPANY INFO");
    expect(prompt).not.toContain("APPLICANT COUNT INSIGHT");
    expect(prompt).not.toContain("ROLE CLASSIFICATION");
  });
});
