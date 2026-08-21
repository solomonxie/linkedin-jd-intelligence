import { useState } from "react";
import { SettingsPanel } from "./SettingsPanel";
import { HistoryPanel } from "./HistoryPanel";

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
      {tab === "history" && <HistoryPanel />}
    </div>
  );
}
