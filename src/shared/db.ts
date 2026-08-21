// IndexedDB wrapper for the JobRecord cache (keyed by LinkedIn job id — upsert,
// so re-analysis replaces rather than duplicates).

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CompanyRecord, JobRecord } from "./types";

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
  return db.get("jobs", id);
}

export async function getAllJobRecords(): Promise<JobRecord[]> {
  const db = await getDb();
  return db.getAll("jobs");
}

export async function getJobRecordsByResumeProfile(resumeProfileId: string): Promise<JobRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex("jobs", "resumeProfileId", resumeProfileId);
}

export async function getJobRecordsByRegion(regionBucket: string): Promise<JobRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex("jobs", "regionBucket", regionBucket);
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
  return db.get("companies", key);
}

export async function upsertCompanyRecord(record: CompanyRecord): Promise<void> {
  const db = await getDb();
  await db.put("companies", record);
}
