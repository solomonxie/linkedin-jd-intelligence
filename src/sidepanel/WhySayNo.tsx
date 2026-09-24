import type { JobRecord } from "../shared/types";

export function WhySayNo({ record }: { record: JobRecord }) {
  const reasons = record.rejectionNote ?? [];
  return (
    <div className="card why-say-no">
      <h3>Why Say No</h3>
      {reasons.length > 0 ? (
        <ul>
          {reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">
          {record.status === "pending" ? "Analyzing…" : "Re-analyze to see the hiring manager's rejection note."}
        </p>
      )}
    </div>
  );
}
