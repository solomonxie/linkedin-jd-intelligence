import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../shared/styles.css";
import { App } from "./App";
import { PrintPage } from "./PrintPage";
import { getJobRecord } from "../shared/db";
import type { JobRecord } from "../shared/types";

// index.html is reused for two purposes: the side panel (normal case), and a
// plain tab opened by "Export as PDF" with ?printJobId=<id> — a normal tab is
// needed because window.print() doesn't reliably work from a side panel.
function Root() {
  const printJobId = new URLSearchParams(window.location.search).get("printJobId");
  const [record, setRecord] = useState<JobRecord | null | undefined>(printJobId ? undefined : null);

  useEffect(() => {
    if (!printJobId) return;
    getJobRecord(printJobId).then((r) => setRecord(r ?? null));
  }, [printJobId]);

  if (!printJobId) return <App />;
  if (record === undefined) return <p className="empty-state">Loading…</p>;
  if (!record) return <p className="empty-state">Job record not found.</p>;
  return <PrintPage record={record} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
