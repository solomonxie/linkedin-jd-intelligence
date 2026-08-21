import { useState } from "react";
import { upsertJobRecord } from "../shared/db";
import { broadcastJobRecordUpdated } from "../shared/messaging";
import type { InterviewRound, JobRecord } from "../shared/types";

const EMPTY_DRAFT = { label: "", durationMinutes: "", mode: "" };

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

export function InterviewRounds({ record }: { record: JobRecord }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);

  const rounds = record.interviewRounds;

  async function persist(next: InterviewRound[]) {
    await upsertJobRecord({ ...record, interviewRounds: next });
    broadcastJobRecordUpdated(record.id);
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

  async function commitEdit() {
    if (editingIndex === null) return;
    const round = toRound(draft);
    if (round) {
      const next = [...rounds];
      next[editingIndex] = round;
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
      {rounds.length === 0 && !adding && <p className="muted">Not mentioned in the posting.</p>}
      <ol className="interview-rounds">
        {rounds.map((round, index) =>
          editingIndex === index ? (
            <li key={index}>
              <RoundEditor draft={draft} onChange={setDraft} onSave={commitEdit} onCancel={() => setEditingIndex(null)} />
            </li>
          ) : (
            <li key={index}>
              <span className="round-label">{index + 1}</span>
              <span>{formatRound(round)}</span>
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
