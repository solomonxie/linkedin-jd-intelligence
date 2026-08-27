// IndexedDB wrapper for the JobRecord cache (keyed by LinkedIn job id — upsert,
// so re-analysis replaces rather than duplicates).

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CompanyInfo, CompanyRecord, Fact, JobRecord } from "./types";

// Records written before companyInfo.domain (Fact<string>) was renamed to
// companyInfo.industry (Fact<string[]>) are still sitting in IndexedDB with
// the old field only — normalize on read so the UI never sees a missing
// `industry` and crashes reading `.value` off it.
function normalizeCompanyInfo(info: CompanyInfo): CompanyInfo {
  let normalized = info;
  if (!normalized.industry) {
    const legacyDomain = (normalized as unknown as { domain?: Fact<string> }).domain;
    const industry: Fact<string[]> = legacyDomain
      ? { value: legacyDomain.value ? [legacyDomain.value] : null, source: legacyDomain.source }
      : { value: null, source: "llm-estimate" };
    normalized = { ...normalized, industry };
  }
  // Records written before companyInfo.headquarters existed — same missing-field crash risk, no
  // legacy field to migrate from, just default it blank.
  if (!normalized.headquarters) {
    normalized = { ...normalized, headquarters: { value: null, source: "llm-estimate" } };
  }
  return normalized;
}

function normalizeJobRecord(record: JobRecord): JobRecord {
  return record.companyInfo ? { ...record, companyInfo: normalizeCompanyInfo(record.companyInfo) } : record;
}

function normalizeCompanyRecord(record: CompanyRecord): CompanyRecord {
  return { ...record, companyInfo: normalizeCompanyInfo(record.companyInfo) };
}

interface JdIntelligenceDB extends DBSchema {
  jobs: {
    key: string;
    value: JobRecord;
    // IndexedDB indexes silently skip records whose indexed field is null/undefined
    // (null isn't a valid IDB key), so a "pending" record with analyzedAt/regionBucket
    // still null just won't show up via these indexes until analysis completes —
    // getAllJobRecords() is the way to see everything regardless of status.
    indexes: {
      analyzedAt: string;
      resumeProfileId: string;
      regionBucket: string;
    };
  };
  companies: {
    key: string;
    value: CompanyRecord;
  };
}

const DB_NAME = "linkedin-jd-intelligence";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<JdIntelligenceDB>> | null = null;

function getDb(): Promise<IDBPDatabase<JdIntelligenceDB>> {
  if (!dbPromise) {
    dbPromise = openDB<JdIntelligenceDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("jobs", { keyPath: "id" });
          store.createIndex("analyzedAt", "analyzedAt");
          store.createIndex("resumeProfileId", "resumeProfileId");
          store.createIndex("regionBucket", "regionBucket");
        }
        if (oldVersion < 2) {
          db.createObjectStore("companies", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function upsertJobRecord(record: JobRecord): Promise<void> {
  const db = await getDb();
  await db.put("jobs", record);
}

export async function getJobRecord(id: string): Promise<JobRecord | undefined> {
  const db = await getDb();
  const record = await db.get("jobs", id);
  return record ? normalizeJobRecord(record) : undefined;
}

export async function getAllJobRecords(): Promise<JobRecord[]> {
  const db = await getDb();
  return (await db.getAll("jobs")).map(normalizeJobRecord);
}

export async function getJobRecordsByResumeProfile(resumeProfileId: string): Promise<JobRecord[]> {
  const db = await getDb();
  return (await db.getAllFromIndex("jobs", "resumeProfileId", resumeProfileId)).map(normalizeJobRecord);
}

export async function getJobRecordsByRegion(regionBucket: string): Promise<JobRecord[]> {
  const db = await getDb();
  return (await db.getAllFromIndex("jobs", "regionBucket", regionBucket)).map(normalizeJobRecord);
}

export async function deleteJobRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("jobs", id);
}

export async function clearAllJobRecords(): Promise<void> {
  const db = await getDb();
  await db.clear("jobs");
}

export async function getCompanyRecord(key: string): Promise<CompanyRecord | undefined> {
  const db = await getDb();
  const record = await db.get("companies", key);
  return record ? normalizeCompanyRecord(record) : undefined;
}

export async function upsertCompanyRecord(record: CompanyRecord): Promise<void> {
  const db = await getDb();
  await db.put("companies", record);
}

export async function getAllCompanyRecords(): Promise<CompanyRecord[]> {
  const db = await getDb();
  return (await db.getAll("companies")).map(normalizeCompanyRecord);
}
