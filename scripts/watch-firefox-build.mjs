import { spawn } from "node:child_process";
import { watchFile, unwatchFile } from "node:fs";
import path from "node:path";

import { manifestPath, patchManifestForFirefox } from "./patch-firefox-manifest.mjs";

const viteBinPath = path.resolve(process.cwd(), "node_modules/vite/bin/vite.js");

let patchQueued = false;
let patchRunning = false;

const runPatch = async () => {
  if (patchRunning) {
    patchQueued = true;

    return;
  }

  patchRunning = true;

  try {
    await patchManifestForFirefox();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ENOENT")) {
      console.error(
        error instanceof Error ? error.message : String(error),
      );
    }
  } finally {
    patchRunning = false;

    if (patchQueued) {
      patchQueued = false;
      void runPatch();
    }
  }
};

const buildProcess = spawn(process.execPath, [viteBinPath, "build", "--watch"], {
  stdio: "inherit",
});

watchFile(manifestPath, { interval: 200 }, (currentStats, previousStats) => {
  if (currentStats.mtimeMs === previousStats.mtimeMs) {
    return;
  }

  void runPatch();
});

const stopWatcher = (signal) => {
  unwatchFile(manifestPath);

  if (buildProcess.pid) {
    buildProcess.kill(signal);
  }
};

process.on("SIGINT", () => {
  stopWatcher("SIGINT");
});

process.on("SIGTERM", () => {
  stopWatcher("SIGTERM");
});

buildProcess.on("exit", (code, signal) => {
  unwatchFile(manifestPath);

  if (signal) {
    process.kill(process.pid, signal);

    return;
  }

  process.exit(code ?? 0);
});
