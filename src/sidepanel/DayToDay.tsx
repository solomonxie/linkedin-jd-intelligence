import type { DayToDayWork } from "../shared/types";

/** Shown while a first-time analysis is running, so the section's place in the panel is visible
 * immediately instead of appearing out of nowhere when the response lands. */
export function DayToDaySkeleton() {
  return (
    <div className="card">
      <h3>Day-to-day work</h3>
      <p className="skeleton-row">Analyzing…</p>
    </div>
  );
}

export function DayToDay({ work }: { work: DayToDayWork }) {
  const split = normalizeSplit(work.split);
  if (!work.brief && split.length === 0) return null;

  return (
    <div className="card">
      <h3>Day-to-day work</h3>
      {work.brief && <p className="day-to-day-brief">{work.brief}</p>}
      {split.length > 0 && (
        <ul className="work-split">
          {split.map(({ area, percent }) => (
            <li key={area}>
              <span className="work-split-area">{area}</span>
              <span className="work-split-bar">
                <span className="work-split-fill" style={{ width: `${percent}%` }} />
              </span>
              <span className="work-split-percent">{percent}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Rescales to sum 100 — the model's percents are only roughly comparable (and sometimes don't add up),
 * so bar widths come from the ratio rather than the raw number. */
export function normalizeSplit(split: DayToDayWork["split"]): DayToDayWork["split"] {
  const total = split.reduce((sum, s) => sum + (Number.isFinite(s.percent) ? s.percent : 0), 0);
  if (total <= 0) return [];
  return split.map((s) => ({ area: s.area, percent: Math.round((s.percent / total) * 100) }));
}
