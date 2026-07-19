import express from "express";
import cors from "cors";
import helmet from "helmet";

import reportsRouter from "./routes/reports.js";
import repliesRouter from "./routes/replies.js";
import evidenceRouter from "./routes/evidence.js";
import adminRouter from "./routes/admin.js";
import newsRouter from "./routes/news.js";

export function createApp() {
  const app = express();

  // Behind a reverse proxy (nginx, Fly, Render, etc.) in production so
  // req.ip reflects the real client IP for rate limiting.
  app.set("trust proxy", true);

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use("/api/reports", reportsRouter);
  app.use("/api/reports", repliesRouter); // nested: /api/reports/:reportId/replies
  app.use("/api/reports", evidenceRouter); // nested: /api/reports/:reportId/evidence
  app.use("/api/admin", adminRouter);
  app.use("/api/news", newsRouter);

  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.publicMessage || "Internal server error" });
  });

  return app;
}
