import type { IncomingMessage, ServerResponse } from "node:http";

type CreateApp = typeof import("../../../apps/api/dist/bootstrap.js").createApp;

let createApp: CreateApp | undefined;
let appPromise: ReturnType<CreateApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const routePath = requestUrl.searchParams.get("__route");

  if (!routePath || routePath.startsWith("/") || routePath.split("/").includes("..")) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  requestUrl.searchParams.delete("__route");
  const targetPath = `/${routePath}`;

  // Keep the platform health probe independent from database/Nest startup.
  if (targetPath === "/health") {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ status: "ok", service: "cs2-cases-api" }));
    return;
  }

  createApp ??= (await import("../../../apps/api/dist/bootstrap.js")).createApp;
  appPromise ??= createApp();
  const app = await appPromise;
  const expressApp = app.getHttpAdapter().getInstance();

  // Vercel rewrites /api/<route> to this fixed function; restore the Nest route.
  req.url = `${targetPath}${requestUrl.search}`;
  expressApp(req, res);
}
