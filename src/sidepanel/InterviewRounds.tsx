import { useState } from "react";
import { upsertJobRecord } from "../shared/db";
import { broadcastJobRecordUpdated } from "../shared/messaging";
import type { InterviewRound, JobRecord } from "../shared/types";

const DEFAULT_DURATION_MINUTES = "60";
const EMPTY_DRAFT = { label: "", mode: "", durationMinutes: DEFAULT_DURATION_MINUTES };

// Fixed vocabularies, so a hand-added round reads the same as an extracted one instead of depending on
// how the user happened to phrase it. Both lists accept an off-list value too (see selectOptions) —
// what the posting actually said always wins over what's offered here.
const INTERVIEW_TYPES = [
  "Recruiter screen",
  "Hiring manager interview",
  "Technical / coding interview",
  "System design interview",
  "Take-home assignment",
  "Behavioral interview",
  "Team / culture fit",
  "Final round",
];
const INTERVIEW_STAGES = ["Phone screen", "Video call", "Virtual onsite", "Onsite", "Take-home", "Async / recorded"];
const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
];

/** The fixed list, plus whatever's already stored when that isn't on it — an extracted round shouldn't
 * silently change value just because the dropdown doesn't offer its exact wording. */
function selectOptions(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

function formatDuration(minutes: number): string {
  return DURATION_OPTIONS.find((o) => Number(o.value) === minutes)?.label ?? `${minutes} min`;
}

function formatRound(round: InterviewRound): string {
  const details = [round.durationMinutes ? formatDuration(round.durationMinutes) : null, round.mode].filter(Boolean);
  return details.length > 0 ? `${round.label} (${details.join(", ")})` : round.label;
}

function toRound(draft: typeof EMPTY_DRAFT): InterviewRound | null {
  const label = draft.label.trim();
  if (!label) return null;
  const durationMinutes = draft.durationMinutes.trim() === "" ? null : Number(draft.durationMinutes);
  return {
    label,
    durationMinutes: durationMinutes !== null && Number.isFinite(durationMinutes) ? durationMinutes : null,
    mode: draft.mode.trim() || null,
    source: "user",
    sourceText: null,
  };
}

export function InterviewRounds({ record, onSaved }: { record: JobRecord; onSaved?: () => void }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const rounds = record.interviewRounds;

  async function persist(next: InterviewRound[]) {
    await upsertJobRecord({ ...record, interviewRounds: next });
    broadcastJobRecordUpdated(record.id);
    onSaved?.();
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...rounds];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persist(next);
  }

  function startEdit(index: number) {
    const round = rounds[index];
    setDraft({
      label: round.label,
      durationMinutes: round.durationMinutes !== null ? String(round.durationMinutes) : "",
      mode: round.mode ?? "",
    });
    setEditingIndex(index);
  }

  async function commitEdit(index: number) {
    const round = toRound(draft);
    if (round) await persist(rounds.map((r, i) => (i === index ? round : r)));
    setEditingIndex(null);
  }

  async function removeRound(index: number) {
    await persist(rounds.filter((_, i) => i !== index));
  }

  async function commitAdd() {
    const round = toRound(draft);
    if (round) await persist([...rounds, round]);
    setDraft(EMPTY_DRAFT);
    setAdding(false);
  }

  return (
    <div className="interview-rounds-section card">
      <h3>Interview Process</h3>
      {rounds.length === 0 && !adding && (
        <p className="empty-note">No interview process found in this job description. Add the rounds yourself as you learn them.</p>
      )}

      <ol className="interview-rounds">
        {rounds.map((round, index) =>
          editingIndex === index ? (
            <li key={index}>
              <RoundEditor draft={draft} onChange={setDraft} onSave={() => commitEdit(index)} onCancel={() => setEditingIndex(null)} />
            </li>
          ) : (
            <li
              key={index}
              className={dragIndex === index ? "dragging" : undefined}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) reorder(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <span className="drag-handle" aria-hidden="true">
                ⠿
              </span>
              <span className="round-label">{index + 1}</span>
              <span className="round-text">
                {formatRound(round)}
                {round.sourceText && <span className="round-source">{round.sourceText}</span>}
              </span>
              {round.source === "user" && <span className="source-badge">edited</span>}
              <button type="button" className="edit-icon" onClick={() => startEdit(index)} aria-label={`Edit round ${index + 1}`}>
                ✎
              </button>
              <button type="button" className="edit-icon" onClick={() => void removeRound(index)} aria-label={`Remove round ${index + 1}`}>
                ✕
              </button>
            </li>
          ),
        )}
      </ol>

      {adding ? (
        <RoundEditor
          draft={draft}
          onChange={setDraft}
          onSave={commitAdd}
          onCancel={() => {
            setAdding(false);
            setDraft(EMPTY_DRAFT);
          }}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)}>
          + Add round
        </button>
      )}
    </div>
  );
}

function RoundEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: typeof EMPTY_DRAFT;
  onChange: (draft: typeof EMPTY_DRAFT) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="field-editor">
      <select
        value={draft.label}
        onChange={(e) => onChange({ ...draft, label: e.target.value })}
        aria-label="Interview type"
        autoFocus
      >
        <option value="">Interview type…</option>
        {selectOptions(INTERVIEW_TYPES, draft.label).map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <select value={draft.mode} onChange={(e) => onChange({ ...draft, mode: e.target.value })} aria-label="Stage">
        <option value="">Stage…</option>
        {selectOptions(INTERVIEW_STAGES, draft.mode).map((stage) => (
          <option key={stage} value={stage}>
            {stage}
          </option>
        ))}
      </select>
      <select
        value={draft.durationMinutes}
        onChange={(e) => onChange({ ...draft, durationMinutes: e.target.value })}
        aria-label="Duration"
      >
        {/* An extracted round often states no duration — that has to stay expressible, or editing one
            would silently stamp a made-up length on it. */}
        <option value="">Duration…</option>
        {selectOptions(
          DURATION_OPTIONS.map((o) => o.value),
          draft.durationMinutes,
        ).map((value) => (
          <option key={value} value={value}>
            {formatDuration(Number(value))}
          </option>
        ))}
      </select>
      <button type="button" onClick={onSave} disabled={!draft.label}>
        Save
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </span>
  );
}
