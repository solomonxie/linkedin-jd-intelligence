import { useCallback, useEffect, useState } from "react";
import { clearAllJobRecords, getAllJobRecords } from "../shared/db";
import { onJobRecordUpdated } from "../shared/messaging";
import { useSettings } from "../shared/useSettings";
import type { JobRecord } from "../shared/types";

export function HistoryPanel() {
  const settings = useSettings();
  const [records, setRecords] = useState<JobRecord[]>([]);
  const [profileFilter, setProfileFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const all = await getAllJobRecords();
    all.sort((a, b) => (b.analyzedAt ?? b.startedAt).localeCompare(a.analyzedAt ?? a.startedAt));
    setRecords(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    return onJobRecordUpdated(() => void reload());
  }, [reload]);

  const filtered = profileFilter === "all" ? records : records.filter((r) => r.resumeProfileId === profileFilter);

  async function handleClear() {
    if (window.confirm(`Delete all ${records.length} cached job analyses? This cannot be undone.`)) {
      await clearAllJobRecords();
      await reload();
    }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `linkedin-jd-intelligence-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <div className="history-panel">
      <h2>History</h2>
      <div className="history-controls">
        <label>
          Resume profile:{" "}
          <select value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)}>
            <option value="all">All profiles</option>
            {settings.resumeProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleExport} disabled={records.length === 0}>
          Export as JSON
        </button>
        <button type="button" onClick={handleClear} disabled={records.length === 0}>
          Clear history
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Company</th>
            <th>Location</th>
            <th>Resume</th>
            <th>Status</th>
            <th>Analyzed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((record) => (
            <tr key={record.id}>
              <td>{record.jobTitle ?? "—"}</td>
              <td>{record.company ?? "—"}</td>
              <td>{record.location ?? "—"}</td>
              <td>{record.resumeProfileName}</td>
              <td>{record.status}</td>
              <td>{record.analyzedAt ? new Date(record.analyzedAt).toLocaleString() : "—"}</td>
              <td>
                <a href={record.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
                No jobs analyzed yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
