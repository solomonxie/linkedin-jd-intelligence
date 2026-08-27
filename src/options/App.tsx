import { SettingsPanel } from "./SettingsPanel";
import { HistoryPanel } from "./HistoryPanel";

// Which panel shows is decided by the URL (?tab=history), not in-page nav —
// History is opened directly from the side panel's footer link now, since a
// tab switcher buried in Settings wasn't a discoverable enough entry point.
export function App() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return <div className="options-app">{tab === "history" ? <HistoryPanel /> : <SettingsPanel />}</div>;
}
