import { describe, expect, it } from "vitest";
import { extractCompanySlugHint, extractTitleSlugHint, humanizeSlug, normalizeCompanyKey } from "./companyKey";

describe("extractCompanySlugHint", () => {
  it("extracts the company slug from a SEO-slugged /jobs/view/ URL", () => {
    expect(
      extractCompanySlugHint(
        "https://www.linkedin.com/jobs/view/senior-software-engineer-backend-lake-analytics-platform-at-affirm-4438379738/",
      ),
    ).toBe("affirm");
  });

  it("uses the last \"-at-\" when the title itself contains the word \"at\"", () => {
    expect(extractCompanySlugHint("https://www.linkedin.com/jobs/view/engineer-at-scale-at-affirm-4438379738/")).toBe(
      "affirm",
    );
  });

  it("returns null for a plain numeric /jobs/view/{id} URL", () => {
    expect(extractCompanySlugHint("https://www.linkedin.com/jobs/view/4123456789/")).toBeNull();
  });

  it("returns null for a search-results/collections URL (no slug in the path)", () => {
    expect(extractCompanySlugHint("https://www.linkedin.com/jobs/search-results/?currentJobId=4423035088")).toBeNull();
  });
});

describe("extractTitleSlugHint", () => {
  it("extracts the title slug from a SEO-slugged /jobs/view/ URL", () => {
    expect(
      extractTitleSlugHint(
        "https://www.linkedin.com/jobs/view/senior-software-engineer-backend-at-affirm-4438379738/",
      ),
    ).toBe("senior-software-engineer-backend");
  });

  it("returns null for a plain numeric /jobs/view/{id} URL", () => {
    expect(extractTitleSlugHint("https://www.linkedin.com/jobs/view/4123456789/")).toBeNull();
  });
});

describe("humanizeSlug", () => {
  it("replaces dashes with spaces", () => {
    expect(humanizeSlug("senior-software-engineer")).toBe("senior software engineer");
  });
});

describe("normalizeCompanyKey", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeCompanyKey("Affirm")).toBe("affirm");
  });

  it("strips common corporate suffixes so slug and full legal name converge", () => {
    expect(normalizeCompanyKey("Affirm, Inc.")).toBe("affirm");
    expect(normalizeCompanyKey("Acme Corp")).toBe("acme");
  });

  it("collapses whitespace differences", () => {
    expect(normalizeCompanyKey("  Some   Team  ")).toBe("someteam");
  });
});
