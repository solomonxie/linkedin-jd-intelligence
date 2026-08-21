// Downloads everything in IndexedDB (job records + the company info cache) as one JSON
// file — a full local backup, usable from both the options History panel and the side panel.

import { getAllCompanyRecords, getAllJobRecords } from "./db";

export async function downloadAllData(): Promise<void> {
  const [jobs, companies] = await Promise.all([getAllJobRecords(), getAllCompanyRecords()]);
  const payload = { exportedAt: new Date().toISOString(), jobs, companies };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `linkedin-jd-intelligence-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
