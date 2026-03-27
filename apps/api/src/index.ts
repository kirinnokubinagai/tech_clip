import { Hono } from "hono";
import { createAuth } from "./auth";
import { createDatabase } from "./db";

import { securityHeadersMiddleware } from "./middleware/security-headers";

import { corsMiddleware } from "./middleware/cors";
import { createSubscriptionRoute } from "./routes/subscription";

/** Cloudflare Workers バインディング型定義 */
type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
  ENVIRONMENT: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APPLE_CLIENT_ID: string;
  APPLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  REVENUECAT_WEBHOOK_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", corsMiddleware);
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
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET, {
    google: {
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
    },
    apple: {
      clientId: c.env.APPLE_CLIENT_ID,
      clientSecret: c.env.APPLE_CLIENT_SECRET,
    },
    github: {
      clientId: c.env.GITHUB_CLIENT_ID,
      clientSecret: c.env.GITHUB_CLIENT_SECRET,
    },
  });
  return auth.handler(c.req.raw);
});

app.all("/api/subscription/*", (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const subscriptionApp = createSubscriptionRoute({
    db,
    webhookSecret: c.env.REVENUECAT_WEBHOOK_SECRET,
  });
  return subscriptionApp.fetch(
    new Request(c.req.url, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    }),
  );
});

export default app;
