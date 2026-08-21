import { useState } from "react";
import { SettingsPanel } from "./SettingsPanel";

type Tab = "settings" | "history";

export function App() {
  const [tab, setTab] = useState<Tab>("settings");

  return (
    <div className="options-app">
      <nav>
        <button type="button" onClick={() => setTab("settings")} disabled={tab === "settings"}>
          Settings
        </button>
        <button type="button" onClick={() => setTab("history")} disabled={tab === "history"}>
          History
        </button>
      </nav>
      {tab === "settings" && <SettingsPanel />}
      {tab === "history" && <p className="muted">History view coming next.</p>}
    </div>
  );
}
