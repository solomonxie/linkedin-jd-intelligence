// Shared React hook: live Settings, kept in sync across the side panel and
// options page via chrome.storage.onChanged.

import { useEffect, useState } from "react";
import { getSettings, onSettingsChanged } from "./storage";
import { DEFAULT_SETTINGS, type Settings } from "./types";

export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    const unsubscribe = onSettingsChanged((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return settings;
}
