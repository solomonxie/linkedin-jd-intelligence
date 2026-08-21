import { useState } from "react";
import { upsertJobRecord } from "../shared/db";
import { broadcastJobRecordUpdated } from "../shared/messaging";
import type { InterviewRound, JobRecord } from "../shared/types";

const EMPTY_DRAFT = { label: "", durationMinutes: "", mode: "" };

// Shown (not persisted) when nothing's been extracted or added yet, so the
// section isn't just a blank "not mentioned" line — editing one commits it
// as the first real round.
const DEFAULT_LABELS = [
  "Recruiter screen",
  "Technical interview",
  "Hiring manager interview",
  "Team / panel interview",
  "Final round / onsite",
];

function formatRound(round: InterviewRound): string {
  const details = [round.durationMinutes ? `${round.durationMinutes} min` : null, round.mode].filter(Boolean);
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
  };
}

export function InterviewRounds({ record, onSaved }: { record: JobRecord; onSaved?: () => void }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const rounds = record.interviewRounds;
  const isPlaceholder = rounds.length === 0;
  const displayRounds: InterviewRound[] = isPlaceholder
    ? DEFAULT_LABELS.map((label) => ({ label, durationMinutes: null, mode: null, source: "page" }))
    : rounds;

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
    const round = displayRounds[index];
    setDraft({
      label: round.label,
      durationMinutes: round.durationMinutes !== null ? String(round.durationMinutes) : "",
      mode: round.mode ?? "",
    });
    setEditingIndex(index);
  }

  async function commitEdit(index: number) {
    const round = toRound(draft);
    if (round) {
      // Editing a placeholder starts a real list with just this one round —
      // the other example rows aren't confirmed data, so they're dropped
      // rather than silently saved alongside it.
      const next = isPlaceholder ? [round] : rounds.map((r, i) => (i === index ? round : r));
      await persist(next);
    }
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
      <ol className="interview-rounds">
        {displayRounds.map((round, index) =>
          editingIndex === index ? (
            <li key={index}>
              <RoundEditor draft={draft} onChange={setDraft} onSave={() => commitEdit(index)} onCancel={() => setEditingIndex(null)} />
            </li>
          ) : (
            <li
              key={index}
              className={[isPlaceholder ? "placeholder" : "", dragIndex === index ? "dragging" : ""].filter(Boolean).join(" ") || undefined}
              draggable={!isPlaceholder}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) reorder(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              {!isPlaceholder && (
                <span className="drag-handle" aria-hidden="true">
                  ⠿
                </span>
              )}
              <span className="round-label">{index + 1}</span>
              <span>{formatRound(round)}</span>
              {round.source === "user" && <span className="source-badge">edited</span>}
              <button type="button" className="edit-icon" onClick={() => startEdit(index)} aria-label={`Edit round ${index + 1}`}>
                ✎
              </button>
              {!isPlaceholder && (
                <button type="button" className="edit-icon" onClick={() => void removeRound(index)} aria-label={`Remove round ${index + 1}`}>
                  ✕
                </button>
              )}
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
      <input
        type="text"
        placeholder="e.g. Technical interview"
        value={draft.label}
        onChange={(e) => onChange({ ...draft, label: e.target.value })}
        autoFocus
      />
      <input
        type="number"
        placeholder="min"
        value={draft.durationMinutes}
        onChange={(e) => onChange({ ...draft, durationMinutes: e.target.value })}
      />
      <input
        type="text"
        placeholder="e.g. virtual"
        value={draft.mode}
        onChange={(e) => onChange({ ...draft, mode: e.target.value })}
      />
      <button type="button" onClick={onSave}>
        Save
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </span>
  );
}
