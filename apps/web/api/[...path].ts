import type { IncomingMessage, ServerResponse } from "node:http";

type CreateApp = typeof import("../../../apps/api/src/bootstrap").createApp;
let createApp: CreateApp | undefined;
let appPromise: ReturnType<CreateApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Keep the platform health probe independent from database/Nest startup.
  if ((req.url ?? "").split("?")[0] === "/api/health") {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ status: "ok", service: "cs2-cases-api" }));
    return;
  }

  createApp ??= (await import("../../../apps/api/src/bootstrap")).createApp;
  appPromise ??= createApp();
  const app = await appPromise;
  const expressApp = app.getHttpAdapter().getInstance();

  // Vercel mounts this function under /api, while Nest controllers are rooted at /.
  if (req.url?.startsWith("/api")) {
    req.url = req.url.slice(4) || "/";
  }

  expressApp(req, res);
}
