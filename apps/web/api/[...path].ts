import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../../../apps/api/src/bootstrap";

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= createApp();
  const app = await appPromise;
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp(req, res);
}
