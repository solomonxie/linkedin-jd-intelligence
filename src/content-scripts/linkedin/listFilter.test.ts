// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyCardState, findJobCards, reasonForCardContent } from "./listFilter";
import { DEFAULT_SETTINGS, type Settings } from "../../shared/types";

function settingsWith(overrides: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

const TITLE = "Senior Software Engineer, Backend";
const HREF = "https://www.linkedin.com/jobs/view/4438392409/?trackingId=abc";

describe("reasonForCardContent", () => {
  const input = { jobId: "4438392409", titleText: TITLE, companyBlob: "Affirm London, ON · Reposted 2 weeks ago" };

  it("returns null when nothing matches", () => {
    expect(reasonForCardContent(input, settingsWith({}))).toBeNull();
  });

  it("matches an explicitly blocked job by id", () => {
    const settings = settingsWith({
      blockedJobs: [{ jobId: "4438392409", jobTitle: "x", company: "x", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "job", jobId: "4438392409" });
  });

  it("matches a blocked company as a substring of the combined company/location/meta blob", () => {
    const settings = settingsWith({
      blockedCompanies: [{ key: "affirm", name: "Affirm", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "company", key: "affirm", name: "Affirm" });
  });

  it("matches a company-name keyword as a substring of the blob", () => {
    const settings = settingsWith({
      companyBlockKeywords: [{ id: "kw1", value: "affirm", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "company-keyword", value: "affirm" });
  });

  it("matches a role-title keyword against the title text alone", () => {
    const settings = settingsWith({
      roleBlockKeywords: [{ id: "kw2", value: "backend", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "role-keyword", value: "backend" });
  });

  it("checks job block before company/keyword blocks", () => {
    const settings = settingsWith({
      blockedJobs: [{ jobId: "4438392409", jobTitle: "x", company: "x", addedAt: "2026-01-01" }],
      companyBlockKeywords: [{ id: "kw", value: "affirm", addedAt: "2026-01-01" }],
    });
    expect(reasonForCardContent(input, settings)).toEqual({ type: "job", jobId: "4438392409" });
  });
});

describe("findJobCards", () => {
  it("finds the card boundary as the ancestor whose text first grows past the title alone", () => {
    document.body.innerHTML = `
      <div id="outer">
        <div id="card">
          <div><p><a href="${HREF}">${TITLE}</a></p></div>
          <span>Affirm</span>
          <span>London, ON</span>
        </div>
      </div>
    `;
    const cards = findJobCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].card.id).toBe("card");
    expect(cards[0].jobId).toBe("4438392409");
    expect(cards[0].titleText).toBe(TITLE);
    expect(cards[0].companyBlob).toContain("Affirm");
    expect(cards[0].companyBlob).toContain("London, ON");
  });

  it("de-duplicates when multiple job-view anchors resolve to the same card boundary", () => {
    document.body.innerHTML = `
      <div id="card">
        <a href="${HREF}">${TITLE}</a>
        <a href="${HREF}">${TITLE}</a>
        <span>Affirm</span>
      </div>
    `;
    expect(findJobCards()).toHaveLength(1);
  });

  it("skips an anchor whose text never grows within the hop limit (no card found)", () => {
    document.body.innerHTML = `<a href="${HREF}">${TITLE}</a>`;
    expect(findJobCards()).toHaveLength(0);
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
