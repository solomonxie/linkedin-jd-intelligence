// Background service worker entry point. Message router and LLM orchestration
// land here in later steps.

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Failed to set side panel behavior", error));
