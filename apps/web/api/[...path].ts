import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../../../apps/api/src/bootstrap";

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= createApp();
  const app = await appPromise;
  const expressApp = app.getHttpAdapter().getInstance();

  // Vercel mounts this function under /api, while Nest controllers are rooted at /.
  if (req.url?.startsWith("/api")) {
    req.url = req.url.slice(4) || "/";
  }

  expressApp(req, res);
}
