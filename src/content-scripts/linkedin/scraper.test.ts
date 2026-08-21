// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { extractJobId, extractRawPageText, isJobPage } from "./scraper";

describe("extractJobId", () => {
  it("extracts the id from a /jobs/view/{id} URL", () => {
    expect(extractJobId("https://www.linkedin.com/jobs/view/4123456789/")).toBe("4123456789");
  });

  it("extracts the id from a /jobs/view/{id} URL with query params", () => {
    expect(extractJobId("https://www.linkedin.com/jobs/view/4123456789?refId=abc")).toBe("4123456789");
  });

  it("extracts the id from a currentJobId query param on a collections page", () => {
    expect(extractJobId("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=987654321")).toBe(
      "987654321",
    );
  });

  it("returns null for a non-job LinkedIn page", () => {
    expect(extractJobId("https://www.linkedin.com/feed/")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(extractJobId("not a url")).toBeNull();
  });
});

describe("isJobPage", () => {
  it("is true when a job id can be extracted", () => {
    expect(isJobPage("https://www.linkedin.com/jobs/view/123/")).toBe(true);
  });

  it("is false otherwise", () => {
    expect(isJobPage("https://www.linkedin.com/feed/")).toBe(false);
  });
});

describe("extractRawPageText", () => {
  it("prefers the main landmark over the rest of the body", () => {
    const doc = new DOMParser().parseFromString(
      `<html><body><nav>Nav noise</nav><main>Job description text</main><footer>Footer noise</footer></body></html>`,
      "text/html",
    );
    expect(extractRawPageText(doc)).toBe("Job description text");
  });

  it("falls back to the full body when there is no main landmark", () => {
    const doc = new DOMParser().parseFromString(`<html><body>Just body text</body></html>`, "text/html");
    expect(extractRawPageText(doc)).toBe("Just body text");
  });

  it("trims surrounding whitespace", () => {
    const doc = new DOMParser().parseFromString(`<html><body><main>  padded text  </main></body></html>`, "text/html");
    expect(extractRawPageText(doc)).toBe("padded text");
  });

  it("caps text length so token cost stays bounded", () => {
    const longText = "x".repeat(30_000);
    const doc = new DOMParser().parseFromString(`<html><body><main>${longText}</main></body></html>`, "text/html");
    expect(extractRawPageText(doc).length).toBe(20_000);
  });
});
