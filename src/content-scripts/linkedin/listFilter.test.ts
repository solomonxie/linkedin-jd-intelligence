// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyCardState, findJobCards, reasonForHref } from "./listFilter";
import { DEFAULT_SETTINGS, type Settings } from "../../shared/types";

function settingsWith(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

const SLUGGED_URL = "https://www.linkedin.com/jobs/view/senior-backend-engineer-at-affirm-4438379738/";
const BARE_URL = "https://www.linkedin.com/jobs/view/4123456789/";

describe("reasonForHref", () => {
  it("returns null when nothing in settings matches", () => {
    expect(reasonForHref(SLUGGED_URL, settingsWith({}))).toBeNull();
  });

  it("matches an explicitly blocked job by id, regardless of slug", () => {
    const settings = settingsWith({
      blockedJobs: [{ jobId: "4438379738", jobTitle: "x", company: "x", addedAt: "2026-01-01" }],
    });
    expect(reasonForHref(SLUGGED_URL, settings)).toEqual({ type: "job", jobId: "4438379738" });
  });

  it("matches a blocked company via the URL's company slug", () => {
    const settings = settingsWith({
      blockedCompanies: [{ key: "affirm", name: "Affirm", addedAt: "2026-01-01" }],
    });
    expect(reasonForHref(SLUGGED_URL, settings)).toEqual({ type: "company", key: "affirm", name: "Affirm" });
  });

  it("matches a company-name keyword via the humanized company slug", () => {
    const settings = settingsWith({
      companyBlockKeywords: [{ id: "kw1", value: "affirm", addedAt: "2026-01-01" }],
    });
    expect(reasonForHref(SLUGGED_URL, settings)).toEqual({ type: "company-keyword", value: "affirm" });
  });

  it("matches a role-title keyword via the humanized title slug", () => {
    const settings = settingsWith({
      roleBlockKeywords: [{ id: "kw2", value: "backend", addedAt: "2026-01-01" }],
    });
    expect(reasonForHref(SLUGGED_URL, settings)).toEqual({ type: "role-keyword", value: "backend" });
  });

  it("still matches an explicit job block on a bare, unslugged URL", () => {
    const settings = settingsWith({
      blockedJobs: [{ jobId: "4123456789", jobTitle: "x", company: "x", addedAt: "2026-01-01" }],
    });
    expect(reasonForHref(BARE_URL, settings)).toEqual({ type: "job", jobId: "4123456789" });
  });

  it("can't apply a company/keyword block on a bare, unslugged URL — never a wrong block, just a miss", () => {
    const settings = settingsWith({
      blockedCompanies: [{ key: "affirm", name: "Affirm", addedAt: "2026-01-01" }],
    });
    expect(reasonForHref(BARE_URL, settings)).toBeNull();
  });
});

describe("findJobCards", () => {
  it("finds each <li> ancestor of a job-view anchor, de-duplicated", () => {
    document.body.innerHTML = `
      <ul>
        <li id="card-1"><a href="${SLUGGED_URL}">Title</a><a href="${SLUGGED_URL}">Company</a></li>
        <li id="card-2"><a href="${BARE_URL}">Other</a></li>
        <div><a href="${SLUGGED_URL}">Not inside an li</a></div>
      </ul>
    `;
    const cards = findJobCards();
    expect(cards.map((c) => c.id).sort()).toEqual(["card-1", "card-2"]);
  });
});

describe("applyCardState", () => {
  it("dims the card and adds a badge when blocked", () => {
    document.body.innerHTML = `<li id="card"></li>`;
    const card = document.getElementById("card")!;
    applyCardState(card, { type: "job", jobId: "1" });
    expect(card.style.opacity).toBe("0.35");
    expect(card.querySelector(".jdi-blocked-badge")).not.toBeNull();
  });

  it("is idempotent — running it twice doesn't add a second badge", () => {
    document.body.innerHTML = `<li id="card"></li>`;
    const card = document.getElementById("card")!;
    applyCardState(card, { type: "job", jobId: "1" });
    applyCardState(card, { type: "job", jobId: "1" });
    expect(card.querySelectorAll(".jdi-blocked-badge").length).toBe(1);
  });

  it("undoes the dim and removes the badge once the card is no longer blocked", () => {
    document.body.innerHTML = `<li id="card"></li>`;
    const card = document.getElementById("card")!;
    applyCardState(card, { type: "job", jobId: "1" });
    applyCardState(card, null);
    expect(card.style.opacity).toBe("");
    expect(card.querySelector(".jdi-blocked-badge")).toBeNull();
  });
});
