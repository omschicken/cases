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

  // Interface previews read only the public live catalog. Never connect a
  // preview to the production database or forward credentials/mutations.
  if (process.env.VERCEL_ENV === "preview") {
    res.setHeader("content-type", "application/json; charset=utf-8");
    if (req.method !== "GET" || !/^\/cases(?:\/[a-z0-9-]+)?$/.test(targetPath)) {
      res.statusCode = 503;
      res.setHeader("cache-control", "no-store");
      res.end(JSON.stringify({ message: "Операции отключены в предварительном просмотре интерфейса" }));
      return;
    }
    try {
      const upstream = await fetch(`https://cases-x18t.vercel.app/api${targetPath}`, { signal: AbortSignal.timeout(12_000) });
      res.statusCode = upstream.status;
      if (upstream.ok) res.setHeader("cache-control", "public, max-age=0, s-maxage=10, stale-while-revalidate=30");
      res.end(await upstream.text());
    } catch {
      res.statusCode = 503;
      res.end(JSON.stringify({ message: "Не удалось загрузить публичный каталог" }));
    }
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
