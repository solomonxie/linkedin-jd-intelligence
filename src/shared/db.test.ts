import { describe, expect, it } from "vitest";
import { getCompanyRecord, upsertCompanyRecord } from "./db";
import type { CompanyRecord } from "./types";

// shared/db.ts caches one IndexedDB connection for the module's lifetime, so
// these tests share a database — each test uses its own key rather than
// resetting state.

describe("company records", () => {
  it("returns undefined for a key that was never stored", async () => {
    expect(await getCompanyRecord("never-stored")).toBeUndefined();
  });

  it("upserts and reads back a company record", async () => {
    const record: CompanyRecord = {
      key: "affirm",
      name: "Affirm",
      companyInfo: {
        industry: { value: ["FinTech"], source: "page" },
        mainProducts: { value: ["BNPL"], source: "llm-estimate" },
        employeeSize: { value: null, source: "llm-estimate" },
        engineeringSize: { value: null, source: "llm-estimate" },
        arr: { value: null, source: "llm-estimate" },
        fundingStage: { value: "Public (NASDAQ)", source: "llm-estimate" },
        ownership: { value: "public", source: "llm-estimate" },
        techStack: { value: null, source: "llm-estimate" },
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    await upsertCompanyRecord(record);
    expect(await getCompanyRecord("affirm")).toEqual(record);
  });

  it("overwrites an existing record on re-upsert with the same key", async () => {
    const key = "acme";
    const base: CompanyRecord = {
      key,
      name: "Acme",
      companyInfo: {
        industry: { value: null, source: "llm-estimate" },
        mainProducts: { value: null, source: "llm-estimate" },
        employeeSize: { value: null, source: "llm-estimate" },
        engineeringSize: { value: null, source: "llm-estimate" },
        arr: { value: null, source: "llm-estimate" },
        fundingStage: { value: null, source: "llm-estimate" },
        ownership: { value: null, source: "llm-estimate" },
        techStack: { value: null, source: "llm-estimate" },
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await upsertCompanyRecord(base);
    const updated = { ...base, name: "Acme Corp", updatedAt: "2026-02-01T00:00:00.000Z" };
    await upsertCompanyRecord(updated);

    expect(await getCompanyRecord(key)).toEqual(updated);
  });

  it("migrates a pre-rename record stored with companyInfo.domain instead of industry", async () => {
    const key = "legacy-co";
    const legacyCompanyInfo = {
      domain: { value: "SaaS", source: "page" },
      mainProducts: { value: null, source: "llm-estimate" },
      employeeSize: { value: null, source: "llm-estimate" },
      engineeringSize: { value: null, source: "llm-estimate" },
      arr: { value: null, source: "llm-estimate" },
      fundingStage: { value: null, source: "llm-estimate" },
      ownership: { value: null, source: "llm-estimate" },
      techStack: { value: null, source: "llm-estimate" },
    };
    // Bypass the CompanyInfo type to simulate a record written before the rename.
    await upsertCompanyRecord({
      key,
      name: "Legacy Co",
      companyInfo: legacyCompanyInfo as unknown as CompanyRecord["companyInfo"],
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const record = await getCompanyRecord(key);
    expect(record?.companyInfo.industry).toEqual({ value: ["SaaS"], source: "page" });
  });
});
