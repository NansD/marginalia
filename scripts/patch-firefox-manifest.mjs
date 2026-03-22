import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const manifestPath = path.resolve(process.cwd(), "dist/manifest.json");

export async function patchManifestForFirefox(targetManifestPath = manifestPath) {
  const raw = await readFile(targetManifestPath, "utf8");
  const manifest = JSON.parse(raw);

  const serviceWorker = manifest.background?.service_worker;
  if (!serviceWorker) {
    throw new Error(
      "Expected dist/manifest.json to include background.service_worker",
    );
  }

  const nextBackground = {
    scripts: [serviceWorker],
    service_worker: serviceWorker,
    type: "module",
  };

  const background = manifest.background;
  const alreadyPatched =
    background?.service_worker === nextBackground.service_worker &&
    background?.type === nextBackground.type &&
    Array.isArray(background?.scripts) &&
    background.scripts.length === nextBackground.scripts.length &&
    background.scripts.every(
      (script, index) => script === nextBackground.scripts[index],
    );

  if (alreadyPatched) {
    return false;
  }

  manifest.background = nextBackground;

  await writeFile(
    targetManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(
    "Patched dist/manifest.json with Firefox-compatible background.scripts fallback.",
  );

  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  patchManifestForFirefox().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
