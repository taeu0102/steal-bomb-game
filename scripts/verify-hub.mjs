import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const requiredFiles = [
  "index.html",
  "portal.css",
  "portal.js",
  "steal-bomb-game/index.html",
  "steal-bomb-game/game.js",
  "steal-bomb-game/public-config.js",
  "interactive-story/index.html",
  "heungbu-nolbu/index.html",
  "ghost-forge/index.html",
  "portfolio-city/index.html",
  "episodes/index.json",
  "episodes/tori-firelight-festival/episode.json",
];

for (const relativePath of requiredFiles) {
  const target = path.join(dist, relativePath);
  await access(target);
  if ((await stat(target)).size === 0) {
    throw new Error(`Empty build artifact: ${relativePath}`);
  }
}

const portalHtml = await readFile(path.join(dist, "index.html"), "utf8");
const portalScript = await readFile(path.join(dist, "portal.js"), "utf8");
const storyHtml = await readFile(
  path.join(dist, "interactive-story", "index.html"),
  "utf8",
);
const manifest = JSON.parse(
  await readFile(path.join(dist, "episodes", "index.json"), "utf8"),
);
const publicConfigScript = await readFile(
  path.join(dist, "steal-bomb-game", "public-config.js"),
  "utf8",
);
const legacyStoryHtml = await readFile(
  path.join(dist, "heungbu-nolbu", "index.html"),
  "utf8",
);

if (!portalHtml.includes("portal.css") || !portalHtml.includes("portal.js")) {
  throw new Error("The root page is not the AI work hub.");
}
if (!portalScript.includes("/interactive-story/")) {
  throw new Error("The hub does not link to the interactive storybook.");
}
if (!storyHtml.includes("/interactive-story/assets/")) {
  throw new Error("The storybook was not built with the hub base path.");
}
if (!manifest.episodes?.some(({ id }) => id === "tori-firelight-festival")) {
  throw new Error("The Tori episode is missing from the episode registry.");
}
if (!legacyStoryHtml.includes('location.replace("/interactive-story/"')) {
  throw new Error("The legacy story URL does not forward to the new path.");
}
if (
  process.env.VERCEL_ENV === "production" &&
  publicConfigScript.includes("replace_me_with_supabase")
) {
  throw new Error("The production card game is missing its Supabase config.");
}

console.log(`Verified ${requiredFiles.length} required hub artifacts.`);
