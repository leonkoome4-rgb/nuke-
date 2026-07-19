// Vercel serverless entrypoint. Distinct from src/server.js (used for local
// dev / any host that runs a persistent process) — this exports the Express
// app itself rather than calling .listen(), since Vercel's Node runtime
// invokes the exported handler per-request instead of binding a port.
import "dotenv/config";
import { createApp } from "../src/app.js";

const app = createApp();

export default app;
