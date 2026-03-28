import { and, desc, eq, like, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import { createAuth } from "./auth";
import { createDatabase } from "./db";
import { articles, follows, notifications, users } from "./db/schema";

import { corsMiddleware } from "./middleware/cors";
import { securityHeadersMiddleware } from "./middleware/security-headers";
import { createSentryMiddleware } from "./middleware/sentry";
import { openApiSpec } from "./openapi";
import { parseArticle } from "./services/article-parser";
import { summarizeArticle } from "./services/summary";
import { translateArticle } from "./services/translator";
import { createAiRoute } from "./routes/ai";
import { createArticlesRoute } from "./routes/articles";
import { createEmailVerificationRoute } from "./routes/email-verification";
import { createFavoriteRoute } from "./routes/favorite";
import { createFollowsRoute } from "./routes/follows";
import { createNotificationSettingsRoute } from "./routes/notification-settings";
import { createNotificationsRoute } from "./routes/notifications";
import { createPasswordResetRoute } from "./routes/password-reset";
import { createPublicArticlesRoute } from "./routes/public-articles";
import { createSearchRoute } from "./routes/search";
import { createSubscriptionRoute } from "./routes/subscription";
import { createSummaryRoute } from "./routes/summary";
import { createTagsRoute } from "./routes/tags";
import { createUsersRoute } from "./routes/users";

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
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  /** レート制限用 Workers KV namespace */
  RATE_LIMIT: KVNamespace;
  /** キャッシュ用 Workers KV namespace */
  CACHE: KVNamespace;
  /** アバター画像保存用 R2 バケット */
  AVATARS_BUCKET: R2Bucket;
  /** アプリのベースURL（パスワードリセットリンク生成用） */
  APP_URL?: string;
  /** Sentry DSN（エラー監視用） */
  SENTRY_DSN?: string;
  /** RevenueCat Webhook シークレット */
  REVENUECAT_WEBHOOK_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", corsMiddleware);
app.use("*", securityHeadersMiddleware);
app.use("*", createSentryMiddleware());

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

app.post("/api/auth/send-verification", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const appUrl =
    c.env.ENVIRONMENT === "production" ? "https://app.techclip.io" : "http://localhost:8081";
  const route = createEmailVerificationRoute({
    db,
    appUrl,
    emailEnv: { RESEND_API_KEY: c.env.RESEND_API_KEY, FROM_EMAIL: c.env.FROM_EMAIL },
  });
  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();
  subApp.route("/api/auth", route);
  return subApp.fetch(c.req.raw);
});

app.post("/api/auth/verify-email", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const appUrl =
    c.env.ENVIRONMENT === "production" ? "https://app.techclip.io" : "http://localhost:8081";
  const route = createEmailVerificationRoute({
    db,
    appUrl,
    emailEnv: { RESEND_API_KEY: c.env.RESEND_API_KEY, FROM_EMAIL: c.env.FROM_EMAIL },
  });
  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();
  subApp.route("/api/auth", route);
  return subApp.fetch(c.req.raw);
});

app.on(["POST", "GET"], "/api/auth/**", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });

  const path = new URL(c.req.url).pathname;

  if (
    c.req.method === "POST" &&
    (path === "/api/auth/forgot-password" || path === "/api/auth/reset-password")
  ) {
    const passwordResetRoute = createPasswordResetRoute({
      db,
      appUrl: c.env.APP_URL ?? "https://app.techclip.example.com",
      emailEnv: { RESEND_API_KEY: c.env.RESEND_API_KEY, FROM_EMAIL: c.env.FROM_EMAIL },
    });
    const subApp = new Hono();
    subApp.route("/api/auth", passwordResetRoute);
    return subApp.fetch(c.req.raw);
  }

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

app.get("/api/users/:id/articles", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });

  const publicArticlesRoute = createPublicArticlesRoute({
    queryFn: async (params) => {
      const conditions = [eq(articles.userId, params.userId), eq(articles.isPublic, true)];
      if (params.cursor) {
        conditions.push(lt(articles.id, params.cursor));
      }
      const results = await db
        .select()
        .from(articles)
        .where(and(...conditions))
        .orderBy(desc(articles.createdAt))
        .limit(params.limit);
      return results as unknown as Array<Record<string, unknown>>;
    },
    userExistsFn: async (userId) => {
      const [found] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      return !!found;
    },
  });

  const subApp = new Hono();
  subApp.route("/api/users", publicArticlesRoute);
  return subApp.fetch(c.req.raw);
});

app.on(["GET", "POST", "PATCH", "DELETE"], "/api/articles/**", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET, {});

  const articlesRoute = createArticlesRoute({
    db,
    parseArticleFn: parseArticle,
    queryFn: async (params) => {
      const conditions = [eq(articles.userId, params.userId)];
      if (params.cursor) {
        conditions.push(lt(articles.id, params.cursor));
      }
      if (params.source !== undefined) {
        conditions.push(eq(articles.source, params.source as string));
      }
      if (params.isFavorite !== undefined) {
        conditions.push(eq(articles.isFavorite, params.isFavorite));
      }
      if (params.isRead !== undefined) {
        conditions.push(eq(articles.isRead, params.isRead));
      }
      const results = await db
        .select()
        .from(articles)
        .where(and(...conditions))
        .orderBy(desc(articles.createdAt))
        .limit(params.limit);
      return results as unknown as Array<Record<string, unknown>>;
    },
  });

  const summaryRoute = createSummaryRoute({
    db,
    summarizeFn: summarizeArticle,
    runpodConfig: {
      apiKey: c.env.RUNPOD_API_KEY,
      endpointId: c.env.RUNPOD_ENDPOINT_ID,
    },
  });

  const aiRoute = createAiRoute({
    db,
    translateArticleFn: translateArticle,
  });

  const favoriteRoute = createFavoriteRoute({ db });

  const searchRoute = createSearchRoute({
    searchQueryFn: async (params) => {
      const keyword = `%${params.query}%`;
      const conditions = [
        eq(articles.userId, params.userId),
        or(
          like(articles.title, keyword),
          like(articles.content, keyword),
          like(articles.excerpt, keyword),
        ),
      ];
      if (params.cursor) {
        conditions.push(lt(articles.id, params.cursor));
      }
      const results = await db
        .select()
        .from(articles)
        .where(and(...conditions))
        .orderBy(desc(articles.createdAt))
        .limit(params.limit);
      return results as unknown as Array<Record<string, unknown>>;
    },
  });

  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  subApp.use("*", async (ctx, next) => {
    const result = await auth.api.getSession({ headers: ctx.req.raw.headers });
    if (result) {
      ctx.set("user", result.user);
    }
    await next();
  });

  subApp.route("/api", articlesRoute);
  subApp.route("/api", summaryRoute);
  subApp.route("/api/articles", aiRoute);
  subApp.route("/api/articles", favoriteRoute);
  subApp.route("/api/articles", searchRoute);

  return subApp.fetch(c.req.raw);
});

app.on(["GET", "POST", "PATCH", "DELETE"], "/api/users/**", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET, {});

  const usersRoute = createUsersRoute({
    db,
    r2Bucket: c.env.AVATARS_BUCKET,
    r2PublicUrl: c.env.ENVIRONMENT === "production"
      ? "https://avatars.techclip.io"
      : undefined,
  });

  const followsRoute = createFollowsRoute({
    db,
    followFn: async (followerId, followingId) => {
      await db.insert(follows).values({ followerId, followingId });
      const [result] = await db
        .select()
        .from(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
      return result as unknown as { followerId: string; followingId: string; createdAt: string };
    },
    unfollowFn: async (followerId, followingId) => {
      await db
        .delete(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    },
    getFollowersFn: async (params) => {
      const conditions = [eq(follows.followingId, params.userId)];
      if (params.cursor) {
        conditions.push(lt(follows.createdAt, params.cursor));
      }
      const results = await db
        .select()
        .from(follows)
        .where(and(...conditions))
        .orderBy(desc(follows.createdAt))
        .limit(params.limit);
      return results as unknown as Array<Record<string, unknown>>;
    },
    getFollowingFn: async (params) => {
      const conditions = [eq(follows.followerId, params.userId)];
      if (params.cursor) {
        conditions.push(lt(follows.createdAt, params.cursor));
      }
      const results = await db
        .select()
        .from(follows)
        .where(and(...conditions))
        .orderBy(desc(follows.createdAt))
        .limit(params.limit);
      return results as unknown as Array<Record<string, unknown>>;
    },
    isFollowingFn: async (followerId, followingId) => {
      const [result] = await db
        .select()
        .from(follows)
        .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
      return !!result;
    },
    userExistsFn: async (userId) => {
      const [found] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      return !!found;
    },
  });

  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  subApp.use("*", async (ctx, next) => {
    const result = await auth.api.getSession({ headers: ctx.req.raw.headers });
    if (result) {
      ctx.set("user", result.user);
    }
    await next();
  });

  subApp.route("/api/users", usersRoute);
  subApp.route("/api/users", followsRoute);

  return subApp.fetch(c.req.raw);
});

app.on(["GET", "POST", "PATCH"], "/api/tags/**", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET, {});

  const tagsRoute = createTagsRoute({ db });

  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  subApp.use("*", async (ctx, next) => {
    const result = await auth.api.getSession({ headers: ctx.req.raw.headers });
    if (result) {
      ctx.set("user", result.user);
    }
    await next();
  });

  subApp.route("/api", tagsRoute);

  return subApp.fetch(c.req.raw);
});

app.on(["GET", "POST", "PATCH"], "/api/notifications/**", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET, {});

  const notificationsRoute = createNotificationsRoute({
    db,
    queryFn: async (params) => {
      const conditions = [eq(notifications.userId, params.userId)];
      if (params.cursor) {
        conditions.push(lt(notifications.id, params.cursor));
      }
      const results = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(params.limit);
      return results as unknown as Array<Record<string, unknown>>;
    },
  });

  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  subApp.use("*", async (ctx, next) => {
    const result = await auth.api.getSession({ headers: ctx.req.raw.headers });
    if (result) {
      ctx.set("user", result.user);
    }
    await next();
  });

  subApp.route("/api", notificationsRoute);

  return subApp.fetch(c.req.raw);
});

app.on(["GET", "PATCH"], "/api/notification-settings/**", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET, {});

  const notificationSettingsRoute = createNotificationSettingsRoute({ db });

  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  subApp.use("*", async (ctx, next) => {
    const result = await auth.api.getSession({ headers: ctx.req.raw.headers });
    if (result) {
      ctx.set("user", result.user);
    }
    await next();
  });

  subApp.route("/api", notificationSettingsRoute);

  return subApp.fetch(c.req.raw);
});

app.on(["GET", "POST"], "/api/subscription/**", async (c) => {
  const db = createDatabase({
    TURSO_DATABASE_URL: c.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: c.env.TURSO_AUTH_TOKEN,
  });
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET, {});

  const subscriptionRoute = createSubscriptionRoute({
    db,
    webhookSecret: c.env.REVENUECAT_WEBHOOK_SECRET ?? "",
  });

  const subApp = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  subApp.use("*", async (ctx, next) => {
    const result = await auth.api.getSession({ headers: ctx.req.raw.headers });
    if (result) {
      ctx.set("user", result.user);
    }
    await next();
  });

  subApp.route("/api/subscription", subscriptionRoute);

  return subApp.fetch(c.req.raw);
});

export default app;
