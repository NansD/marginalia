import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Marginalia",
  version: "0.1.0",
  description: "Local-first web annotation workspace for the browser.",
  permissions: ["activeTab", "scripting", "storage", "tabs"],
  host_permissions: ["http://*/*", "https://*/*"],
  action: {
    default_title: "Marginalia",
    default_popup: "popup.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  options_page: "options.html",
  commands: {
    "toggle-annotation-mode": {
      suggested_key: {
        default: "Ctrl+Shift+Y",
        mac: "Command+Shift+Y",
      },
      description: "Toggle Marginalia annotation mode",
    },
  },
});
