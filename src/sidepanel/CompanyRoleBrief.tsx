import { useState } from "react";
import { upsertJobRecord } from "../shared/db";
import { broadcastJobRecordUpdated } from "../shared/messaging";
import type { CompanyInfo, Fact, JobRecord, RoleInfo } from "../shared/types";

type FieldKind = "text" | "array" | "enum" | "number";
type FieldGroup = "companyInfo" | "role";

interface FieldDef {
  key: string;
  group: FieldGroup;
  label: string;
  kind: FieldKind;
  enumOptions?: string[];
  format?: (value: unknown) => string;
}

const FIELDS: FieldDef[] = [
  { key: "industry", group: "companyInfo", label: "Industry", kind: "array" },
  { key: "headquarters", group: "companyInfo", label: "Headquarters", kind: "text" },
  { key: "mainProducts", group: "companyInfo", label: "Products", kind: "array" },
  { key: "employeeSize", group: "companyInfo", label: "Size", kind: "text" },
  { key: "engineeringSize", group: "companyInfo", label: "Eng. size", kind: "text" },
  { key: "arr", group: "companyInfo", label: "ARR", kind: "text" },
  // "ownership" is rendered specially below, combined with fundingStage — see formatOwnership().
  { key: "ownership", group: "companyInfo", label: "Ownership", kind: "enum", enumOptions: ["public", "private"] },
  { key: "techStack", group: "companyInfo", label: "Tech stack", kind: "array" },
  { key: "team", group: "role", label: "Team", kind: "text" },
  { key: "teamMission", group: "role", label: "Team mission", kind: "text" },
  { key: "salaryRange", group: "role", label: "Salary", kind: "text", format: (v) => formatSalaryDigits(String(v)) },
  {
    key: "applicantCount",
    group: "role",
    label: "Applicants",
    kind: "number",
    format: (v) => `${v} applied`,
  },
  {
    key: "seniorHeadcount",
    group: "role",
    label: "Senior level",
    kind: "number",
    format: (v) => `${v} applied`,
  },
];

// Strips thousands-separator commas from a salary string ("$150,000-$190,000
// CAD" -> "$150000-$190000 CAD"), leaving the $ sign, currency code, and any
// other non-numeric text untouched.
function formatSalaryDigits(raw: string): string {
  return raw.replace(/\d[\d,]*/g, (match) => match.replace(/,/g, ""));
}

// Public ownership makes funding stage moot, so the "Ownership" row folds both facts into one line
// instead of showing a separate, usually-empty "Stage" row for public companies.
function formatOwnership(ownership: string | null, fundingStage: string | null): string {
  if (ownership === "public") return "Public";
  if (ownership === "private") return fundingStage ? `Private, ${fundingStage}` : "Private";
  return fundingStage ?? "";
}

function ownershipBlank(companyInfo: CompanyInfo): boolean {
  return isBlank(companyInfo.ownership.value) && isBlank(companyInfo.fundingStage.value);
}

function ownershipBadge(companyInfo: CompanyInfo): "edited" | "est" | null {
  const { ownership, fundingStage } = companyInfo;
  if (ownership.source === "user" || fundingStage.source === "user") return "edited";
  if (ownership.source === "llm-estimate" || fundingStage.source === "llm-estimate") return "est";
  return null;
}

function isBlank(value: unknown): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function formatForInput(value: unknown, kind: FieldKind): string {
  if (value === null || value === undefined) return "";
  if (kind === "array" && Array.isArray(value)) return value.join(", ");
  return String(value);
}

function parseInput(raw: string, kind: FieldKind): unknown {
  const trimmed = raw.trim();
  if (kind === "array") {
    const items = trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }
  if (kind === "number") {
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return trimmed === "" ? null : trimmed;
}

// Falls back to a blank fact for a field a cached record predates (e.g. a schema field added after
// the record was analyzed) instead of crashing on .value — see the companyInfo.domain->industry
// migration history in shared/db.ts for why this bites in practice.
function factOf(def: FieldDef, companyInfo: CompanyInfo, role: RoleInfo): Fact<unknown> {
  const source = def.group === "companyInfo" ? companyInfo : role;
  return (source as unknown as Record<string, Fact<unknown>>)[def.key] ?? { value: null, source: "llm-estimate" };
}

function displayValue(def: FieldDef, value: unknown): string {
  return def.format ? def.format(value) : Array.isArray(value) ? value.join(", ") : String(value);
}

/** Shown in place of CompanyRoleBrief while a first-time analysis is still running, so the panel's
 * shape is visible immediately instead of an empty gap. */
export function CompanyRoleBriefSkeleton() {
  return (
    <div className="brief card">
      <h3>Company & Role Brief</h3>
      <ul>
        {FIELDS.map((def) => (
          <li key={def.key}>
            <span className="brief-label">{def.label}</span>
            <span className="skeleton-row">…</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompanyRoleBrief({ record, onSaved }: { record: JobRecord; onSaved?: () => void }) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [addingKey, setAddingKey] = useState("");
  const [addDraft, setAddDraft] = useState("");

  if (!record.companyInfo || !record.role) return null;
  const companyInfo: CompanyInfo = record.companyInfo;
  const role: RoleInfo = record.role;

  async function save(def: FieldDef, rawValue: string) {
    const fact: Fact<unknown> = { value: parseInput(rawValue, def.kind), source: "user" };
    const updated: JobRecord =
      def.group === "companyInfo"
        ? { ...record, companyInfo: { ...companyInfo, [def.key]: fact } }
        : { ...record, role: { ...role, [def.key]: fact } };
    await upsertJobRecord(updated);
    broadcastJobRecordUpdated(record.id);
    onSaved?.();
  }

  function startEdit(def: FieldDef) {
    setDraft(formatForInput(factOf(def, companyInfo, role).value, def.kind));
    setEditingKey(def.key);
  }

  async function commitEdit(def: FieldDef) {
    await save(def, draft);
    setEditingKey(null);
  }

  async function commitAdd(def: FieldDef) {
    await save(def, addDraft);
    setAddingKey("");
    setAddDraft("");
  }

  async function saveOwnership(ownership: "public" | "private" | null, fundingStage: string | null) {
    const updated: JobRecord = {
      ...record,
      companyInfo: {
        ...companyInfo,
        ownership: { value: ownership, source: "user" },
        fundingStage: { value: fundingStage, source: "user" },
      },
    };
    await upsertJobRecord(updated);
    broadcastJobRecordUpdated(record.id);
    onSaved?.();
  }

  const blankFields = FIELDS.filter((def) =>
    def.key === "ownership" ? ownershipBlank(companyInfo) : isBlank(factOf(def, companyInfo, role).value),
  );

  return (
    <div className="brief card">
      <h3>Company & Role Brief</h3>
      <ul>
        {FIELDS.map((def) => {
          const editing = editingKey === def.key;

          if (def.key === "ownership") {
            if (ownershipBlank(companyInfo) && !editing) return null;
            const badge = ownershipBadge(companyInfo);
            return (
              <li key={def.key}>
                <span className="brief-label">{def.label}</span>
                {editing ? (
                  <OwnershipEditor
                    ownership={companyInfo.ownership.value}
                    fundingStage={companyInfo.fundingStage.value}
                    onSave={(ownership, fundingStage) => {
                      void saveOwnership(ownership, fundingStage);
                      setEditingKey(null);
                    }}
                    onCancel={() => setEditingKey(null)}
                  />
                ) : (
                  <>
                    <span>{formatOwnership(companyInfo.ownership.value, companyInfo.fundingStage.value)}</span>
                    {badge && <span className="source-badge">{badge}</span>}
                    <button type="button" className="edit-icon" onClick={() => setEditingKey(def.key)} aria-label="Edit Ownership">
                      ✎
                    </button>
                  </>
                )}
              </li>
            );
          }

          const fact = factOf(def, companyInfo, role);
          if (isBlank(fact.value) && !editing) return null;

          return (
            <li key={def.key}>
              <span className="brief-label">{def.label}</span>
              {editing ? (
                <FieldEditor def={def} value={draft} onChange={setDraft} onSave={() => commitEdit(def)} onCancel={() => setEditingKey(null)} />
              ) : (
                <>
                  <span>{displayValue(def, fact.value)}</span>
                  {fact.source === "llm-estimate" && <span className="source-badge">est</span>}
                  {fact.source === "user" && <span className="source-badge">edited</span>}
                  <button type="button" className="edit-icon" onClick={() => startEdit(def)} aria-label={`Edit ${def.label}`}>
                    ✎
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {role.applicantCountInsight && <p className="applicant-insight">💡 {role.applicantCountInsight}</p>}

      {blankFields.length > 0 && (
        <div className="brief-add-field">
          <select
            value={addingKey}
            onChange={(e) => {
              setAddingKey(e.target.value);
              setAddDraft("");
            }}
          >
            <option value="">+ Add field…</option>
            {blankFields.map((def) => (
              <option key={def.key} value={def.key}>
                {def.label}
              </option>
            ))}
          </select>
          {addingKey === "ownership" && (
            <OwnershipEditor
              ownership={companyInfo.ownership.value}
              fundingStage={companyInfo.fundingStage.value}
              onSave={(ownership, fundingStage) => {
                void saveOwnership(ownership, fundingStage);
                setAddingKey("");
              }}
              onCancel={() => setAddingKey("")}
            />
          )}
          {addingKey && addingKey !== "ownership" && (
            <FieldEditor
              def={FIELDS.find((f) => f.key === addingKey)!}
              value={addDraft}
              onChange={setAddDraft}
              onSave={() => commitAdd(FIELDS.find((f) => f.key === addingKey)!)}
              onCancel={() => {
                setAddingKey("");
                setAddDraft("");
              }}
            />
          )}
        </div>
      )}

      <p className="muted">est = LLM's general knowledge, not verified — may be stale. edited = you changed this.</p>
    </div>
  );
}

function FieldEditor({
  def,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  def: FieldDef;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="field-editor">
      {def.kind === "enum" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {def.enumOptions?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={def.kind === "number" ? "number" : "text"}
          value={value}
          placeholder={def.kind === "array" ? "comma-separated" : undefined}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      )}
      <button type="button" onClick={onSave}>
        Save
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </span>
  );
}

// The stage input only shows while private is selected — a public company has no stage to enter.
function OwnershipEditor({
  ownership,
  fundingStage,
  onSave,
  onCancel,
}: {
  ownership: "public" | "private" | null;
  fundingStage: string | null;
  onSave: (ownership: "public" | "private" | null, fundingStage: string | null) => void;
  onCancel: () => void;
}) {
  const [ownershipDraft, setOwnershipDraft] = useState(ownership ?? "");
  const [stageDraft, setStageDraft] = useState(fundingStage ?? "");

  return (
    <span className="field-editor">
      <select value={ownershipDraft} onChange={(e) => setOwnershipDraft(e.target.value)}>
        <option value="">—</option>
        <option value="public">public</option>
        <option value="private">private</option>
      </select>
      {ownershipDraft === "private" && (
        <input
          type="text"
          value={stageDraft}
          placeholder="funding stage, e.g. Series A"
          onChange={(e) => setStageDraft(e.target.value)}
          autoFocus
        />
      )}
      <button
        type="button"
        onClick={() =>
          onSave(ownershipDraft === "" ? null : (ownershipDraft as "public" | "private"), stageDraft.trim() || null)
        }
      >
        Save
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </span>
  );
}
