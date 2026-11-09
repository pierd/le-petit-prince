// Lists every file the "save for offline" button downloads, with sizes, in
// public/offline.json: the reader's data, the illustrations it shows and the
// chapter audio (URLs as the app requests them, audio with its ?v= hash).
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pub = join(dirname(dirname(fileURLToPath(import.meta.url))), "public");
const files = [];
const add = (url, path = url.split("?")[0]) => files.push({ url, bytes: statSync(join(pub, path)).size });

add("data/toc.json");
add("data/verbs.json");
add("data/lexicon.json");
const images = new Set();
for (const name of readdirSync(join(pub, "data", "chapters")).sort()) {
  add(`data/chapters/${name}`);
  const chapter = JSON.parse(readFileSync(join(pub, "data", "chapters", name), "utf8"));
  for (const b of chapter.blocks) if (b.type === "img") images.add(b.src);
}
for (const src of [...images].sort()) add(`images/${src}`);
let audio = {};
try {
  add("data/audio.json");
  audio = JSON.parse(readFileSync(join(pub, "data", "audio.json"), "utf8"));
} catch {
  /* no audio generated */
}
for (const { src } of Object.values(audio)) add(`audio/${src}`);

const total = files.reduce((n, f) => n + f.bytes, 0);
writeFileSync(join(pub, "offline.json"), JSON.stringify({ total, files }));
console.log(`offline.json: ${files.length} files, ${(total / 1e6).toFixed(1)} MB`);
