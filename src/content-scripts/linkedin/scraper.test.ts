// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { extractJobId, extractRawPageText, extractRawPageTextWhenReady, isJobPage } from "./scraper";

describe("extractJobId", () => {
  it("extracts the id from a /jobs/view/{id} URL", () => {
    expect(extractJobId("https://www.linkedin.com/jobs/view/4123456789/")).toBe("4123456789");
  });

  it("extracts the id from a /jobs/view/{id} URL with query params", () => {
    expect(extractJobId("https://www.linkedin.com/jobs/view/4123456789?refId=abc")).toBe("4123456789");
  });

  it("extracts the id from LinkedIn's SEO-slugged /jobs/view/{title-slug}-{id} URL", () => {
    expect(
      extractJobId(
        "https://www.linkedin.com/jobs/view/senior-software-engineer-backend-lake-analytics-platform-at-affirm-4438379738/",
      ),
    ).toBe("4438379738");
  });

  it("extracts the id from a slugged URL with query params", () => {
    expect(extractJobId("https://www.linkedin.com/jobs/view/staff-engineer-at-acme-4123456789?refId=abc")).toBe(
      "4123456789",
    );
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

describe("extractRawPageTextWhenReady", () => {
  it("waits for the page text to stop changing before returning it", async () => {
    const doc = new DOMParser().parseFromString(`<html><body><main>Loading…</main></body></html>`, "text/html");
    setTimeout(() => {
      doc.querySelector("main")!.textContent = "Full job description text";
    }, 5);

    const text = await extractRawPageTextWhenReady(doc, { pollIntervalMs: 20, timeoutMs: 200 });
    expect(text).toBe("Full job description text");
  });

  it("clicks 'Show more'/'See more' toggles but leaves 'Show less' alone", async () => {
    const doc = new DOMParser().parseFromString(
      `<html><body><main>
        <div id="jd">Intro text</div>
        <button id="more">Show more</button>
        <button id="less">Show less</button>
      </main></body></html>`,
      "text/html",
    );
    let moreClicked = false;
    let lessClicked = false;
    doc.querySelector("#more")!.addEventListener("click", () => (moreClicked = true));
    doc.querySelector("#less")!.addEventListener("click", () => (lessClicked = true));

    await extractRawPageTextWhenReady(doc, { pollIntervalMs: 5, timeoutMs: 20 });

    expect(moreClicked).toBe(true);
    expect(lessClicked).toBe(false);
  });
});
