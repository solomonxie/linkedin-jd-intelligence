// Typed wrapper around chrome.storage.local for the Settings singleton
// (API key, model, resume profiles). Not encrypted beyond normal
// browser-profile sandboxing.

import { DEFAULT_SETTINGS, type ResumeProfile, type Settings } from "./types";

const STORAGE_KEY = "settings";

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

/** Read-modify-write helper; accepts either a partial patch or an updater function. */
export async function updateSettings(
  update: Partial<Settings> | ((current: Settings) => Settings),
): Promise<Settings> {
  const current = await getSettings();
  const next = typeof update === "function" ? update(current) : { ...current, ...update };
  await setSettings(next);
  return next;
}

/** Notifies `callback` with the latest settings whenever they change (e.g. from another view). */
export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) return;
    callback({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue as Partial<Settings>) });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function addResumeProfile(profile: ResumeProfile, makeActive = true): Promise<Settings> {
  return updateSettings((s) => ({
    ...s,
    resumeProfiles: [...s.resumeProfiles, profile],
    activeResumeProfileId: makeActive ? profile.id : s.activeResumeProfileId,
  }));
}

export async function renameResumeProfile(id: string, name: string): Promise<Settings> {
  return updateSettings((s) => ({
    ...s,
    resumeProfiles: s.resumeProfiles.map((p) => (p.id === id ? { ...p, name } : p)),
  }));
}

export async function deleteResumeProfile(id: string): Promise<Settings> {
  return updateSettings((s) => {
    const resumeProfiles = s.resumeProfiles.filter((p) => p.id !== id);
    const activeResumeProfileId =
      s.activeResumeProfileId === id ? (resumeProfiles[0]?.id ?? null) : s.activeResumeProfileId;
    return { ...s, resumeProfiles, activeResumeProfileId };
  });
}

export async function setActiveResumeProfile(id: string): Promise<Settings> {
  return updateSettings((s) => ({ ...s, activeResumeProfileId: id }));
}
