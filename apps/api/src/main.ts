import { ConfigService } from "@nestjs/config";
import { createApp } from "./bootstrap";

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
}

void bootstrap();
