import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "LinkedIn Job Helper",
  version: pkg.version,
  description: pkg.description,
  permissions: ["storage", "unlimitedStorage", "sidePanel"],
  host_permissions: ["https://www.linkedin.com/*", "https://api.openai.com/*"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  options_ui: {
    page: "src/options/index.html",
    open_in_tab: true,
  },
  content_scripts: [
    {
      matches: ["https://www.linkedin.com/jobs/*"],
      js: ["src/content-scripts/linkedin/index.ts"],
      run_at: "document_idle",
    },
  ],
  // TODO: add icons once we have real artwork; unpacked extensions load fine without them.
});
