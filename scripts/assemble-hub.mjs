import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const storyBuild = path.join(root, ".hub-dist");
const hubSource = path.join(root, "hub-static");

const required = (name) => path.join(hubSource, name);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const name of ["index.html", "portal.css", "portal.js"]) {
  await cp(required(name), path.join(dist, name));
}

for (const name of ["assets", "steal-bomb-game", "ghost-forge", "portfolio-city"]) {
  await cp(required(name), path.join(dist, name), { recursive: true });
}

await cp(storyBuild, path.join(dist, "interactive-story"), { recursive: true });
await rm(path.join(dist, "interactive-story", "episodes"), {
  recursive: true,
  force: true,
});
await mkdir(path.join(dist, "heungbu-nolbu"), { recursive: true });
await writeFile(
  path.join(dist, "heungbu-nolbu", "index.html"),
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/interactive-story/"><link rel="canonical" href="https://taeu0102-ai.vercel.app/interactive-story/"><title>체험형 동화로 이동 중</title></head><body><p><a href="/interactive-story/">체험형 동화로 이동하기</a></p><script>location.replace("/interactive-story/" + location.search + location.hash)</script></body></html>`,
  "utf8",
);
await cp(path.join(root, "public", "episodes"), path.join(dist, "episodes"), {
  recursive: true,
});

const config = JSON.parse(await readFile(required("hub-config.json"), "utf8"));
const publicConfig = {
  supabaseUrl: process.env.SUPABASE_URL || config.supabaseUrl,
  supabaseAnonKey:
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    config.supabaseAnonKey,
};
await writeFile(
  path.join(dist, "steal-bomb-game", "public-config.js"),
  `window.STEAL_BOMB_CONFIG = ${JSON.stringify(publicConfig)};\n`,
  "utf8",
);

console.log("Assembled the AI work hub, existing games, and storybook in dist.");
