import { existsSync } from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";

const DOWNLOAD_FILENAME = "BrewDesk-1.0.0-win.zip";

function findRepoRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolveDownloadPath(): string | null {
  const candidates: string[] = [];

  // Self-contained copy bundled next to the running module (prod: dist/downloads).
  const moduleDir = import.meta.dirname;
  if (moduleDir) {
    candidates.push(path.join(moduleDir, "downloads", DOWNLOAD_FILENAME));
  }

  // Repo-relative source (covers dev, where the module runs from src/).
  const repoRoot = findRepoRoot(process.cwd());
  const roots = repoRoot ? [repoRoot, process.cwd()] : [process.cwd()];
  for (const root of roots) {
    candidates.push(
      path.join(root, "artifacts", "brewdesk", "public", "downloads", DOWNLOAD_FILENAME),
      path.join(root, "artifacts", "brewdesk", "dist", "public", "downloads", DOWNLOAD_FILENAME),
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const router: IRouter = Router();

router.get("/download/desktop", (req, res) => {
  const filePath = resolveDownloadPath();

  if (!filePath) {
    req.log.error("desktop download file not found on disk; redirecting to static path");
    res.redirect(302, `/downloads/${DOWNLOAD_FILENAME}`);
    return;
  }

  res.download(filePath, DOWNLOAD_FILENAME, (err) => {
    if (err && !res.headersSent) {
      req.log.error(
        { err: { message: err.message } },
        "desktop download failed to send file",
      );
      res.status(500).json({ error: "Failed to send desktop download." });
    }
  });
});

export default router;
