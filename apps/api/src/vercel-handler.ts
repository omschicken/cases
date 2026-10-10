import type { IncomingMessage, ServerResponse } from "node:http";
import { INestApplication } from "@nestjs/common";
import { createApplication } from "./main";

let applicationPromise: Promise<INestApplication> | undefined;

async function getApplication() {
  applicationPromise ??= createApplication();
  return applicationPromise;
}

export async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApplication();
    const url = req.url ?? "/";
    if (url === "/api" || url === "/api/") {
      req.url = "/";
    } else if (url.startsWith("/api/")) {
      req.url = url.slice(4);
    }

    const expressHandler = app.getHttpAdapter().getInstance() as (
      request: IncomingMessage,
      response: ServerResponse,
    ) => void;
    expressHandler(req, res);
  } catch (error) {
    console.error("Vercel API initialization failed", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ statusCode: 500, message: "Internal server error" }));
    }
  }
}
