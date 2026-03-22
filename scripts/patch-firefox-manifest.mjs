import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve(process.cwd(), "dist/manifest.json");

async function patchManifestForFirefox() {
  const raw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  const serviceWorker = manifest.background?.service_worker;
  if (!serviceWorker) {
    throw new Error(
      "Expected dist/manifest.json to include background.service_worker",
    );
  }

  manifest.background = {
    scripts: [serviceWorker],
    service_worker: serviceWorker,
    type: "module",
  };

  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(
    "Patched dist/manifest.json with Firefox-compatible background.scripts fallback.",
  );
}

patchManifestForFirefox().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
