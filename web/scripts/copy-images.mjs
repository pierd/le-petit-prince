// Copies the book's illustrations (../images) into public/ for Vite to serve.
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = dirname(dirname(fileURLToPath(import.meta.url)));
cpSync(join(web, "..", "images"), join(web, "public", "images"), { recursive: true });
