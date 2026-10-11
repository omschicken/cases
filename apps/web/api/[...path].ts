import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../../../apps/api/src/bootstrap";

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Keep the platform health probe independent from database/Nest startup.
  if ((req.url ?? "").split("?")[0] === "/api/health") {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ status: "ok", service: "cs2-cases-api" }));
    return;
  }

  appPromise ??= createApp();
  const app = await appPromise;
  const expressApp = app.getHttpAdapter().getInstance();

  // Vercel mounts this function under /api, while Nest controllers are rooted at /.
  if (req.url?.startsWith("/api")) {
    req.url = req.url.slice(4) || "/";
  }

  expressApp(req, res);
}
