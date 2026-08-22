// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyCardState, findJobCards, reasonForCardContent } from "./listFilter";
import { DEFAULT_SETTINGS, type Settings } from "../../shared/types";

function settingsWith(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

const TITLE = "Senior Software Developer – Backend Services";

function jobCardHtml(jobId: string, title: string, company: string, location: string): string {
  return `
    <div role="button" componentkey="job-card-component-ref-${jobId}">
      <div componentkey="job-card-component-ref-${jobId}">
        <p>${title}</p>
        <div><p>${company}</p></div>
        <p>${location}</p>
      </div>
    </div>
  `;
}

describe("reasonForCardContent", () => {
  const input = { jobId: "4454678676", titleText: TITLE, companyBlob: "PDF Solutions Vancouver, BC · 4 hours ago" };

  it("returns null when nothing matches", () => {
    expect(reasonForCardContent(input, settingsWith({}))).toBeNull();
  });

  it("matches an explicitly blocked job by id", () => {
    const settings = settingsWith({
      blockedJobs: [{ jobId: "4454678676", jobTitle: "x", company: "x", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "job", jobId: "4454678676" });
  });

  it("matches a blocked company as a substring of the combined company/location/meta blob", () => {
    const settings = settingsWith({
      blockedCompanies: [{ key: "pdfsolutions", name: "PDF Solutions", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "company", key: "pdfsolutions", name: "PDF Solutions" });
  });

  it("matches a company-name keyword as a substring of the blob", () => {
    const settings = settingsWith({
      companyBlockKeywords: [{ id: "kw1", value: "pdf solutions", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "company-keyword", value: "pdf solutions" });
  });

  it("matches a role-title keyword against the title text alone", () => {
    const settings = settingsWith({
      roleBlockKeywords: [{ id: "kw2", value: "backend", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "role-keyword", value: "backend" });
  });

  it("checks job block before company/keyword blocks", () => {
    const settings = settingsWith({
      blockedJobs: [{ jobId: "4454678676", jobTitle: "x", company: "x", addedAt: "2026-01-01" }],
      companyBlockKeywords: [{ id: "kw", value: "pdf", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "job", jobId: "4454678676" });
  });
});

describe("findJobCards", () => {
  it("finds a card via its componentkey and extracts jobId/title/company blob", () => {
    document.body.innerHTML = `<ul>${jobCardHtml("4454678676", TITLE, "PDF Solutions", "Vancouver, BC")}</ul>`;
    const cards = findJobCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].jobId).toBe("4454678676");
    expect(cards[0].titleText).toBe(TITLE);
    expect(cards[0].companyBlob).toContain("PDF Solutions");
    expect(cards[0].companyBlob).toContain("Vancouver, BC");
  });

  it("de-duplicates the outer/inner elements that share the same componentkey", () => {
    document.body.innerHTML = jobCardHtml("4454678676", TITLE, "PDF Solutions", "Vancouver, BC");
    expect(findJobCards()).toHaveLength(1);
  });

  it("finds multiple distinct cards", () => {
    document.body.innerHTML =
      jobCardHtml("1", "Software Engineer", "Acme", "Remote") + jobCardHtml("2", "Data Engineer", "Beta Corp", "NYC");
    const cards = findJobCards();
    expect(cards.map((c) => c.jobId).sort()).toEqual(["1", "2"]);
  });

  it("ignores elements with no componentkey (e.g. the detail pane)", () => {
    document.body.innerHTML = `<div role="button"><p>${TITLE}</p><p>PDF Solutions</p></div>`;
    expect(findJobCards()).toHaveLength(0);
  });
});

describe("applyCardState", () => {
  it("hides the card entirely when blocked", () => {
    document.body.innerHTML = `<div id="card"></div>`;
    const card = document.getElementById("card")!;
    applyCardState(card, { type: "job", jobId: "1" });
    expect(card.style.display).toBe("none");
  });

  it("un-hides the card once it's no longer blocked", () => {
    document.body.innerHTML = `<div id="card"></div>`;
    const card = document.getElementById("card")!;
    applyCardState(card, { type: "job", jobId: "1" });
    applyCardState(card, null);
    expect(card.style.display).toBe("");
  });
});
