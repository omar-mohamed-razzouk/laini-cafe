import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

declare const __APP_VERSION__: string | undefined;

function readFromRepo(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, "app-version.json");
    if (existsSync(candidate)) {
      try {
        const parsed = JSON.parse(readFileSync(candidate, "utf8")) as { version?: unknown };
        return typeof parsed.version === "string" ? parsed.version : null;
      } catch {
        return null;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export const APP_VERSION: string =
  (typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__) ||
  readFromRepo() ||
  "unknown";
