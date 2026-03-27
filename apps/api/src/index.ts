import { Hono } from "hono";
import { createAuth } from "./auth";
import { createDatabase } from "./db";

import { securityHeadersMiddleware } from "./middleware/security-headers";

/** Cloudflare Workers バインディング型定義 */
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
  ENVIRONMENT: string;
  BETTER_AUTH_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", securityHeadersMiddleware);

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.on(["POST", "GET"], "/api/auth/**", (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET);
  return auth.handler(c.req.raw);
});

export default app;
