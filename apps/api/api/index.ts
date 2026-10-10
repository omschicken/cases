import { vercelHandler } from "../src/vercel-handler";

export const config = { api: { bodyParser: false } };

export default vercelHandler;
