import { Hono } from "hono";

import { corsMiddleware } from "./middleware/cors";

/** Cloudflare Workers バインディング型定義 */
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
  ENVIRONMENT: string;
  // AVATARS_BUCKET: R2Bucket  // 後で有効化
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", corsMiddleware);

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export default app;
