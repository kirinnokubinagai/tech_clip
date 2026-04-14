import { Hono } from "hono";

import { handleAnalytics } from "./app/analytics-subapp";
import { handleArticles, handlePublicArticles } from "./app/articles-subapp";
import { handleAuthCatchAll, handleAuthRoute, handleEmailVerification } from "./app/auth-subapp";
import { handleHealth } from "./app/health-subapp";
import { handleNotificationSettings, handleNotifications } from "./app/notifications-subapp";
import { handleSubscription } from "./app/subscription-subapp";
import { handleTags } from "./app/tags-subapp";
import { handlePublicProfile, handleUsers } from "./app/users-subapp";
import { createAuth } from "./auth";
import { createDatabase } from "./db";
import { corsMiddleware } from "./middleware/cors";
import { createDbInitMiddleware } from "./middleware/db-init";
import {
  createKvStore,
  createRateLimitMiddleware,
  RATE_LIMIT_CONFIG,
} from "./middleware/rateLimit";
import { securityHeadersMiddleware } from "./middleware/security-headers";
import { createSentryMiddleware } from "./middleware/sentry";
import { openApiSpec } from "./openapi";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", corsMiddleware);
app.use("*", securityHeadersMiddleware);
app.use("*", createSentryMiddleware());

app.use(
  "/api/*",
  createDbInitMiddleware({
    createDatabaseFn: createDatabase,
    createAuthFn: createAuth,
  }),
);

/** 認証ルートのレート制限（10リクエスト/分） */
app.use("/api/auth/*", (c, next) =>
  createRateLimitMiddleware(RATE_LIMIT_CONFIG.auth, createKvStore(c.env.RATE_LIMIT))(c, next),
);

/** 一般APIのレート制限（100リクエスト/分） */
app.use("/api/*", (c, next) =>
  createRateLimitMiddleware(RATE_LIMIT_CONFIG.general, createKvStore(c.env.RATE_LIMIT))(c, next),
);

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.on(["GET"], "/api/health", async (c) => {
  return handleHealth(c.get("db"), c.req.raw);
});

app.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

app.on(["POST", "GET"], "/api/auth/sign-in", async (c) => {
  return handleAuthRoute(c.get("db"), c.get("auth")(), c.req.raw);
});

app.post("/api/auth/sign-out", async (c) => {
  return handleAuthRoute(c.get("db"), c.get("auth")(), c.req.raw);
});

app.get("/api/auth/session", async (c) => {
  return handleAuthRoute(c.get("db"), c.get("auth")(), c.req.raw);
});

app.post("/api/auth/refresh", async (c) => {
  return handleAuthRoute(c.get("db"), c.get("auth")(), c.req.raw);
});

app.post("/api/auth/send-verification", async (c) => {
  return handleEmailVerification(c.get("db"), c.env, c.req.raw);
});

app.post("/api/auth/verify-email", async (c) => {
  return handleEmailVerification(c.get("db"), c.env, c.req.raw);
});

app.on(["POST", "GET"], "/api/auth/**", async (c) => {
  return handleAuthCatchAll(c.get("db"), c.env, c.get("auth")(), c.req.raw);
});

app.get("/api/users/:id/articles", async (c) => {
  return handlePublicArticles(c.get("db"), c.req.raw);
});

app.get("/api/users/:id/profile", async (c) => {
  return handlePublicProfile(c.get("db"), c.req.raw);
});

app.on(["GET", "POST", "PATCH", "DELETE"], "/api/articles/**", async (c) => {
  return handleArticles(c.get("db"), c.env, c.get("auth")(), c.req.raw);
});

app.on(["GET", "POST", "PATCH", "DELETE"], "/api/users/**", async (c) => {
  return handleUsers(c.get("db"), c.env, c.get("auth")(), c.req.raw);
});

app.on(["GET", "POST", "PATCH"], "/api/tags/**", async (c) => {
  return handleTags(c.get("db"), c.get("auth")(), c.req.raw);
});

app.on(["GET", "POST", "PATCH"], "/api/notifications/**", async (c) => {
  return handleNotifications(c.get("db"), c.get("auth")(), c.req.raw);
});

app.on(["GET", "PATCH"], "/api/notification-settings/**", async (c) => {
  return handleNotificationSettings(c.get("db"), c.get("auth")(), c.req.raw);
});

app.on(["GET", "POST"], "/api/subscription/**", async (c) => {
  return handleSubscription(c.get("db"), c.env, c.get("auth")(), c.req.raw);
});

app.on(["POST"], "/api/analytics/**", async (c) => {
  return handleAnalytics(c.get("db"), c.get("auth")(), c.req.raw);
});

export default app;
