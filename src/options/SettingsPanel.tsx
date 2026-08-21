import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSettings } from "../shared/useSettings";
import {
  addResumeProfile,
  deleteResumeProfile,
  renameResumeProfile,
  setActiveResumeProfile,
  updateSettings,
} from "../shared/storage";
import { parseResumeFile } from "../shared/resumeParser";
import { DEFAULT_SETTINGS } from "../shared/types";

const MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

export function SettingsPanel() {
  const settings = useSettings();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
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
    await updateSettings({ openaiApiKey: apiKeyInput.trim() || null });
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

      <div className="field">
        <label htmlFor="api-key">OpenAI API key</label>
        <input
          id="api-key"
          type="password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="sk-..."
        />
        <button type="button" onClick={handleSaveApiKey}>
          Save
        </button>
        {savedNotice && <span className="muted"> Saved.</span>}
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
    </div>
  );
}
