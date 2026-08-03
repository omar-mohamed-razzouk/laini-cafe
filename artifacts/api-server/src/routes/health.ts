import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { APP_VERSION } from "../lib/app-version.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ version: APP_VERSION });
});

export default router;
