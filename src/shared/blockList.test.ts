import { describe, expect, it } from "vitest";
import { checkBlocked } from "./blockList";
import { DEFAULT_SETTINGS, type Settings } from "./types";

function settingsWith(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe("checkBlocked", () => {
  it("returns null when nothing matches", () => {
    const settings = settingsWith({});
    expect(checkBlocked(settings, { jobId: "1", company: "Acme", jobTitle: "Engineer" })).toBeNull();
  });

  it("matches an explicitly blocked job by id", () => {
    const settings = settingsWith({
      blockedJobs: [{ jobId: "42", jobTitle: "Engineer", company: "Acme", addedAt: "2026-01-01" }],
    });
    expect(checkBlocked(settings, { jobId: "42", company: null, jobTitle: null })).toEqual({
      type: "job",
      jobId: "42",
    });
  });

  it("matches a blocked company regardless of legal-suffix formatting", () => {
    const settings = settingsWith({
      blockedCompanies: [{ key: "affirm", name: "Affirm", addedAt: "2026-01-01" }],
    });
    expect(checkBlocked(settings, { jobId: "1", company: "Affirm, Inc.", jobTitle: null })).toEqual({
      type: "company",
      key: "affirm",
      name: "Affirm",
    });
  });

  it("matches a company-name keyword case-insensitively as a substring", () => {
    const settings = settingsWith({
      companyBlockKeywords: [{ id: "kw1", value: "staffing", addedAt: "2026-01-01" }],
    });
    expect(checkBlocked(settings, { jobId: "1", company: "Acme Staffing Solutions", jobTitle: null })).toEqual({
      type: "company-keyword",
      value: "staffing",
    });
  });

  it("matches a role-title keyword case-insensitively as a substring", () => {
    const settings = settingsWith({
      roleBlockKeywords: [{ id: "kw2", value: "contract", addedAt: "2026-01-01" }],
    });
    expect(checkBlocked(settings, { jobId: "1", company: null, jobTitle: "Contract Backend Engineer" })).toEqual({
      type: "role-keyword",
      value: "contract",
    });
  });

  it("checks job block before company/keyword blocks", () => {
    const settings = settingsWith({
      blockedJobs: [{ jobId: "1", jobTitle: "x", company: "x", addedAt: "2026-01-01" }],
      companyBlockKeywords: [{ id: "kw", value: "acme", addedAt: "2026-01-01" }],
    });
    expect(checkBlocked(settings, { jobId: "1", company: "Acme", jobTitle: null })).toEqual({
      type: "job",
      jobId: "1",
    });
  });
});
