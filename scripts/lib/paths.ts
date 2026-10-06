import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const PROJECTS_DIR = path.join(ROOT, "projects");
export const AUDIO_LIBRARY_DIR = path.join(PUBLIC_DIR, "audio-library");
export const CATALOG_PATH = path.join(AUDIO_LIBRARY_DIR, "catalog.json");

export const projectPaths = (id: string) => {
  const authoring = path.join(PROJECTS_DIR, id);
  const assets = path.join(PUBLIC_DIR, "projects", id);
  return {
    authoring,
    brief: path.join(authoring, "brief.json"),
    plan: path.join(authoring, "plan.md"),
    spec: path.join(authoring, "spec.json"),
    metadata: path.join(authoring, "youtube-metadata.md"),
    assets,
    imagesDir: path.join(assets, "images"),
    voiceDir: path.join(assets, "voice"),
    renderData: path.join(assets, "render.json"),
    /** public-relative paths, as used by staticFile() */
    publicImage: (sceneIndex: number) =>
      `projects/${id}/images/${sceneFile(sceneIndex)}.png`,
    publicVoice: (sceneIndex: number) =>
      `projects/${id}/voice/${sceneFile(sceneIndex)}.wav`,
  };
};

export const sceneFile = (i: number) => `scene-${String(i + 1).padStart(2, "0")}`;

export const toPublicAbs = (publicRel: string) =>
  path.join(PUBLIC_DIR, ...publicRel.split("/"));

export const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(file, "utf8")) as T;

export const writeJson = (file: string, data: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
};

/** First positional CLI arg = project id */
export const requireProjectId = (usage: string) => {
  const id = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!id) {
    console.error(`Usage: ${usage}`);
    process.exit(1);
  }
  if (!fs.existsSync(projectPaths(id).spec)) {
    console.error(`Không tìm thấy ${projectPaths(id).spec}`);
    process.exit(1);
  }
  return id;
};

export const hasFlag = (name: string) => process.argv.includes(`--${name}`);
