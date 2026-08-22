import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSettings } from "../shared/useSettings";
import {
  addCompanyBlockKeyword,
  addResumeProfile,
  addRoleBlockKeyword,
  deleteResumeProfile,
  removeCompanyBlockKeyword,
  removeRoleBlockKeyword,
  renameResumeProfile,
  setActiveResumeProfile,
  unblockCompany,
  unblockJob,
  updateSettings,
} from "../shared/storage";
import { parseResumeFile } from "../shared/resumeParser";
import { DEFAULT_SETTINGS } from "../shared/types";
import { verifyOpenAiApiKey } from "../background/llm/openaiClient";

const MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

export function SettingsPanel() {
  const settings = useSettings();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // useSettings() starts at the DEFAULT_SETTINGS singleton and only ever
  // replaces it with a freshly-spread object once the real value has loaded
  // (see shared/storage.ts getSettings) — so this reference check fires
  // exactly once, syncing the field's initial value without clobbering
  // whatever the user is actively typing on every later settings change.
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!loadedOnce.current && settings !== DEFAULT_SETTINGS) {
      setApiKeyInput(settings.openaiApiKey ?? "");
      loadedOnce.current = true;
    }
  }, [settings]);

  async function handleSaveApiKey() {
    const trimmed = apiKeyInput.trim();
    setVerifyError(null);

    if (trimmed) {
      setVerifying(true);
      const result = await verifyOpenAiApiKey(trimmed);
      setVerifying(false);
      if (!result.ok) {
        setVerifyError(result.error ?? "Couldn't verify this key with OpenAI.");
        return;
      }
    }

    await updateSettings({ openaiApiKey: trimmed || null });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setUploadError(null);
    setUploadWarning(null);
    setUploading(true);
    try {
      const { text, warning } = await parseResumeFile(file);
      await addResumeProfile({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.(pdf|docx)$/i, ""),
        fileName: file.name,
        parsedAt: new Date().toISOString(),
        text,
      });
      if (warning) setUploadWarning(warning);
    } catch (error) {
      setUploadError((error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleRename(id: string, currentName: string) {
    const name = window.prompt("Rename resume profile", currentName);
    if (name && name.trim()) void renameResumeProfile(id, name.trim());
  }

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Delete resume profile "${name}"? This cannot be undone.`)) {
      void deleteResumeProfile(id);
    }
  }

  return (
    <div className="settings-panel">
      <h2>Settings</h2>

      <p className="privacy-note">
        Your resume, this API key, and every job analysis are stored only in this browser profile
        (nothing on any server this extension's developer runs). The only place any of that data is
        sent is to OpenAI's API, using the key below, to generate the analysis you request — that's
        it. Not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.
      </p>

      <div className="field">
        <label htmlFor="api-key">OpenAI API key</label>
        <input
          id="api-key"
          type="password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="sk-..."
        />
        <button type="button" onClick={handleSaveApiKey} disabled={verifying}>
          {verifying ? "Verifying…" : "Save"}
        </button>
        {savedNotice && <span className="muted"> Verified and saved.</span>}
        {verifyError && <p className="error">{verifyError}</p>}
        <p className="muted">
          Stored locally in this browser profile only — not encrypted beyond normal browser sandboxing.
        </p>
      </div>

      <div className="field">
        <label htmlFor="model">Model</label>
        <select
          id="model"
          value={settings.openaiModel}
          onChange={(e) => void updateSettings({ openaiModel: e.target.value })}
        >
          {MODEL_OPTIONS.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <h3>Resume profiles</h3>
        <ul className="resume-profile-list">
          {settings.resumeProfiles.map((profile) => (
            <li key={profile.id}>
              <label>
                <input
                  type="radio"
                  name="active-resume"
                  checked={profile.id === settings.activeResumeProfileId}
                  onChange={() => void setActiveResumeProfile(profile.id)}
                />
                {profile.name}
                {profile.id === settings.activeResumeProfileId && " (active)"}
              </label>
              <button type="button" onClick={() => handleRename(profile.id, profile.name)}>
                Rename
              </button>
              <button type="button" onClick={() => handleDelete(profile.id, profile.name)}>
                Delete
              </button>
            </li>
          ))}
          {settings.resumeProfiles.length === 0 && <li className="muted">No resume profiles yet.</li>}
        </ul>
        <input type="file" accept=".pdf,.docx" onChange={handleUpload} disabled={uploading} />
        {uploading && <p className="muted">Parsing…</p>}
        {uploadWarning && <p className="warning">{uploadWarning}</p>}
        {uploadError && <p className="error">{uploadError}</p>}
      </div>

      <div className="field">
        <h3>Blocked companies & jobs</h3>
        <p className="muted">Added via "Block this job"/"Block this company" in the side panel.</p>
        <ul className="blocked-list">
          {settings.blockedCompanies.map((c) => (
            <li key={c.key}>
              <span>
                {c.sampleJobUrl ? (
                  <a href={c.sampleJobUrl} target="_blank" rel="noreferrer">
                    {c.name}
                  </a>
                ) : (
                  c.name
                )}{" "}
                (company)
              </span>
              <button type="button" onClick={() => void unblockCompany(c.key)}>
                Unblock
              </button>
            </li>
          ))}
          {settings.blockedJobs.map((j) => (
            <li key={j.jobId}>
              <span>
                {j.url ? (
                  <a href={j.url} target="_blank" rel="noreferrer">
                    {j.jobTitle || "Unknown job"} - {j.company || "Unknown company"}
                  </a>
                ) : (
                  <>
                    {j.jobTitle || "Unknown job"} - {j.company || "Unknown company"}
                  </>
                )}
              </span>
              <button type="button" onClick={() => void unblockJob(j.jobId)}>
                Unblock
              </button>
            </li>
          ))}
          {settings.blockedCompanies.length === 0 && settings.blockedJobs.length === 0 && (
            <li className="muted">None yet.</li>
          )}
        </ul>
      </div>

      <div className="field">
        <h3>Company name block keywords</h3>
        <p className="muted">A job is skipped automatically when its company name contains any of these.</p>
        <ul className="blocked-list">
          {settings.companyBlockKeywords.map((k) => (
            <li key={k.id}>
              <span>{k.value}</span>
              <button type="button" onClick={() => void removeCompanyBlockKeyword(k.id)}>
                Remove
              </button>
            </li>
          ))}
          {settings.companyBlockKeywords.length === 0 && <li className="muted">None yet.</li>}
        </ul>
        <KeywordAdder onAdd={(value) => void addCompanyBlockKeyword(value)} placeholder="e.g. Staffing Agency" />
      </div>

      <div className="field">
        <h3>Role title block keywords</h3>
        <p className="muted">A job is skipped automatically when its title contains any of these.</p>
        <ul className="blocked-list">
          {settings.roleBlockKeywords.map((k) => (
            <li key={k.id}>
              <span>{k.value}</span>
              <button type="button" onClick={() => void removeRoleBlockKeyword(k.id)}>
                Remove
              </button>
            </li>
          ))}
          {settings.roleBlockKeywords.length === 0 && <li className="muted">None yet.</li>}
        </ul>
        <KeywordAdder onAdd={(value) => void addRoleBlockKeyword(value)} placeholder="e.g. Contract" />
      </div>
    </div>
  );
}

function KeywordAdder({ onAdd, placeholder }: { onAdd: (value: string) => void; placeholder: string }) {
  const [value, setValue] = useState("");

  function commit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  return (
    <div className="keyword-adder">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      <button type="button" onClick={commit}>
        Add
      </button>
    </div>
  );
}
