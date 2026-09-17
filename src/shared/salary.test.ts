import { describe, expect, it } from "vitest";
import { normalizeSalaryRange } from "./salary";

describe("normalizeSalaryRange", () => {
  it("collapses a written-out range to the fixed shape", () => {
    expect(normalizeSalaryRange("$120,000 - $150,000")).toBe("$120k-150k USD");
    expect(normalizeSalaryRange("$120,000.00–$150,000.00 per year")).toBe("$120k-150k USD");
    expect(normalizeSalaryRange("120000 to 150000 USD")).toBe("$120k-150k USD");
  });

  it("puts the currency after the amount, never as a symbol prefix", () => {
    expect(normalizeSalaryRange("C$100,000-C$200,000")).toBe("$100k-200k CAD");
    expect(normalizeSalaryRange("CAD $145,000")).toBe("$145k CAD");
    expect(normalizeSalaryRange("£90,000 - £110,000")).toBe("$90k-110k GBP");
  });

  it("keeps a single figure single", () => {
    expect(normalizeSalaryRange("$180,000")).toBe("$180k USD");
    expect(normalizeSalaryRange("$180k - $180k")).toBe("$180k USD");
  });

  it("understands k and M shorthand", () => {
    expect(normalizeSalaryRange("$120k–$150k")).toBe("$120k-150k USD");
    expect(normalizeSalaryRange("$1.2M CAD")).toBe("$1200k CAD");
  });

  it("formats hourly pay as an hourly rate", () => {
    expect(normalizeSalaryRange("$50 - $70 per hour")).toBe("$50-70/hr USD");
    expect(normalizeSalaryRange("CAD 62.50/hr")).toBe("$63/hr CAD");
  });

  it("ignores a 401(k) mention rather than reading it as a figure", () => {
    expect(normalizeSalaryRange("$120,000-$150,000 plus 401(k) match")).toBe("$120k-150k USD");
  });

  it("leaves unparseable pay wording as written", () => {
    expect(normalizeSalaryRange("Competitive, based on experience")).toBe("Competitive, based on experience");
    expect(normalizeSalaryRange(null)).toBeNull();
    expect(normalizeSalaryRange("  ")).toBeNull();
  });

  it("orders a backwards range low to high", () => {
    expect(normalizeSalaryRange("$150,000 down from $120,000")).toBe("$120k-150k USD");
  });
});
