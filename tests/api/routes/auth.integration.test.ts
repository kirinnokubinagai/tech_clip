/**
 * 認証クリティカルパス統合テスト
 *
 * サインイン → セッション確認 → トークンリフレッシュ のフローを
 * インメモリ SQLite + 実 Hono アプリ (app.request) で検証する。
 */

import { accounts, sessions, users } from "@api/db/schema/index";
import { HTTP_OK, HTTP_UNAUTHORIZED, HTTP_UNPROCESSABLE_ENTITY } from "@api/lib/http-status";
import { createAuthRoute } from "@api/routes/auth";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用固定値 */
const TEST_USER_ID = "user_e2e_01";
const TEST_EMAIL = "e2e@example.com";
const TEST_TOKEN = "e2e-session-token-abc123";
/** リフレッシュトークンはセッションID（sessions.id）を使用する */
const TEST_SESSION_ID = "session_e2e_01";
const TEST_REFRESH_TOKEN = "e2e-refresh-token-xyz789";
const FUTURE_EXPIRES = new Date(Date.now() + 86_400_000).toISOString();
const PAST_EXPIRES = new Date(Date.now() - 1_000).toISOString();

/** インメモリ SQLite DB を作成する */
function createTestDb() {
  const client = createClient({ url: "file::memory:" });
  return drizzle(client);
}

/** テスト用のシードデータを挿入する */
async function seedTestData(db: ReturnType<typeof createTestDb>) {
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    name: "E2Eテストユーザー",
  });

  await db.insert(accounts).values({
    id: "account_e2e_01",
    userId: TEST_USER_ID,
    accountId: TEST_USER_ID,
    providerId: "credential",
    password: "hashed_password",
  });

  await db.insert(sessions).values({
    id: "session_e2e_01",
    userId: TEST_USER_ID,
    token: TEST_TOKEN,
    expiresAt: FUTURE_EXPIRES,
  });
}

/** Better Auth モックを生成する */
function createMockAuth(overrides?: {
  signInResult?: {
    token: string | null;
    user: Record<string, unknown>;
  } | null;
  getSessionResult?: {
    session: { token: string; expiresAt: Date };
    user: Record<string, unknown>;
  } | null;
}) {
  const mockUser = {
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    name: "E2Eテストユーザー",
    image: null,
    createdAt: "2024-01-15T00:00:00.000Z",
    updatedAt: "2024-01-15T00:00:00.000Z",
  };

  return {
    api: {
      signInEmail: vi
        .fn()
        .mockResolvedValue(
          overrides?.signInResult !== undefined
            ? overrides.signInResult
            : { token: TEST_TOKEN, user: mockUser },
        ),
      getSession: vi.fn().mockResolvedValue(
        overrides?.getSessionResult !== undefined
          ? overrides.getSessionResult
          : {
              user: mockUser,
              session: {
                token: TEST_TOKEN,
                expiresAt: new Date(Date.now() + 86_400_000),
              },
            },
      ),
    },
  };
}

/** テスト用 Hono アプリを構築する */
function buildTestApp(
  db: ReturnType<typeof createTestDb>,
  mockAuth: ReturnType<typeof createMockAuth>,
) {
  const app = new Hono();
  const authRoute = createAuthRoute({
    db: db as never,
    getAuth: () => mockAuth as never,
  });
  app.route("/api/auth", authRoute);
  return app;
}

describe("E2E: 認証クリティカルパス", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(async () => {
    db = createTestDb();
    await db.run(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, image TEXT, email_verified INTEGER DEFAULT 0, username TEXT UNIQUE, bio TEXT, website_url TEXT, github_username TEXT, twitter_username TEXT, avatar_url TEXT, is_profile_public INTEGER DEFAULT 1, preferred_language TEXT DEFAULT 'ja', is_premium INTEGER DEFAULT 0, premium_expires_at TEXT, free_ai_uses_remaining INTEGER DEFAULT 5, free_ai_reset_at TEXT, push_token TEXT, push_enabled INTEGER DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
    );
    await db.run(
      "CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, account_id TEXT NOT NULL, provider_id TEXT NOT NULL, access_token TEXT, refresh_token TEXT, access_token_expires_at TEXT, refresh_token_expires_at TEXT, scope TEXT, id_token TEXT, password TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
    );
    await db.run(
      "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, ip_address TEXT, user_agent TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
    );
    await seedTestData(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("サインイン (POST /api/auth/sign-in)", () => {
    describe("正常系", () => {
      it("有効な認証情報でサインインできること", async () => {
        // Arrange
        const mockAuth = createMockAuth();
        const app = buildTestApp(db, mockAuth);

        // Act
        const res = await app.request("/api/auth/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: TEST_EMAIL,
            password: "Password123",
          }),
        });

        // Assert
        expect(res.status).toBe(HTTP_OK);
        const body = (await res.json()) as {
          success: true;
          data: {
            user: { id: string; email: string; name: string };
            session: { token: string; expiresAt: string };
          };
        };
        expect(body.success).toBe(true);
        expect(body.data.user.email).toBe(TEST_EMAIL);
        expect(body.data.user.id).toBe(TEST_USER_ID);
        expect(body.data.session.token).toBe(TEST_TOKEN);
        expect(body.data.session.expiresAt).toBeDefined();
      });
    });

    describe("異常系", () => {
      it("メールアドレスが不正な場合422が返ること", async () => {
        // Arrange
        const app = buildTestApp(db, createMockAuth());

        // Act
        const res = await app.request("/api/auth/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "invalid-not-email",
            password: "Password123",
          }),
        });

        // Assert
        expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
        const body = (await res.json()) as {
          success: false;
          error: { code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("VALIDATION_FAILED");
      });

      it("認証情報が不正な場合401が返ること", async () => {
        // Arrange
        const mockAuth = createMockAuth({ signInResult: null });
        const app = buildTestApp(db, mockAuth);

        // Act
        const res = await app.request("/api/auth/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: TEST_EMAIL,
            password: "WrongPassword",
          }),
        });

        // Assert
        expect(res.status).toBe(HTTP_UNAUTHORIZED);
        const body = (await res.json()) as {
          success: false;
          error: { code: string; message: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("AUTH_INVALID");
        expect(body.error.message).toContain("認証情報");
      });
    });
  });

  describe("セッション確認 (GET /api/auth/session)", () => {
    describe("正常系", () => {
      it("有効なトークンでセッションを取得できること", async () => {
        // Arrange
        const mockAuth = createMockAuth();
        const app = buildTestApp(db, mockAuth);

        // Act
        const res = await app.request("/api/auth/session", {
          method: "GET",
          headers: { Authorization: `Bearer ${TEST_TOKEN}` },
        });

        // Assert
        expect(res.status).toBe(HTTP_OK);
        const body = (await res.json()) as {
          success: true;
          data: {
            user: { id: string; email: string };
            session: { token: string; expiresAt: string };
          };
        };
        expect(body.success).toBe(true);
        expect(body.data.user.id).toBe(TEST_USER_ID);
        expect(body.data.user.email).toBe(TEST_EMAIL);
        expect(body.data.session.token).toBe(TEST_TOKEN);
      });
    });

    describe("異常系", () => {
      it("Authorization ヘッダーがない場合401が返ること", async () => {
        // Arrange
        const app = buildTestApp(db, createMockAuth());

        // Act
        const res = await app.request("/api/auth/session", {
          method: "GET",
        });

        // Assert
        expect(res.status).toBe(HTTP_UNAUTHORIZED);
        const body = (await res.json()) as {
          success: false;
          error: { code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("AUTH_REQUIRED");
      });

      it("無効なトークンの場合401が返ること", async () => {
        // Arrange
        const mockAuth = createMockAuth({ getSessionResult: null });
        const app = buildTestApp(db, mockAuth);

        // Act
        const res = await app.request("/api/auth/session", {
          method: "GET",
          headers: { Authorization: "Bearer invalid-token-xyz" },
        });

        // Assert
        expect(res.status).toBe(HTTP_UNAUTHORIZED);
        const body = (await res.json()) as {
          success: false;
          error: { code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("AUTH_REQUIRED");
      });
    });
  });

  describe("トークンリフレッシュ (POST /api/auth/refresh)", () => {
    describe("正常系", () => {
      it("有効なリフレッシュトークンでトークンを取得できること", async () => {
        // Arrange
        const mockAuth = createMockAuth();
        const app = buildTestApp(db, mockAuth);

        // Act: リフレッシュトークンはセッションID（sessions.id）を使用する
        const res = await app.request("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: TEST_SESSION_ID }),
        });

        // Assert
        expect(res.status).toBe(HTTP_OK);
        const body = (await res.json()) as {
          success: true;
          data: { token: string };
        };
        expect(body.success).toBe(true);
        expect(body.data.token).toBe(TEST_TOKEN);
      });
    });

    describe("異常系", () => {
      it("存在しないリフレッシュトークンの場合401が返ること", async () => {
        // Arrange
        const app = buildTestApp(db, createMockAuth());

        // Act
        const res = await app.request("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: "nonexistent-token-xxx" }),
        });

        // Assert
        expect(res.status).toBe(HTTP_UNAUTHORIZED);
        const body = (await res.json()) as {
          success: false;
          error: { code: string; message: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("AUTH_EXPIRED");
        expect(body.error.message).toContain("セッション");
      });

      it("有効期限切れのトークンの場合401が返ること", async () => {
        // Arrange — 期限切れセッションを追加
        await db.insert(sessions).values({
          id: "session_e2e_expired",
          userId: TEST_USER_ID,
          token: TEST_REFRESH_TOKEN,
          expiresAt: PAST_EXPIRES,
        });
        const app = buildTestApp(db, createMockAuth());

        // Act
        const res = await app.request("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: TEST_REFRESH_TOKEN }),
        });

        // Assert
        expect(res.status).toBe(HTTP_UNAUTHORIZED);
        const body = (await res.json()) as {
          success: false;
          error: { code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("AUTH_EXPIRED");
      });

      it("リフレッシュトークンが空の場合422が返ること", async () => {
        // Arrange
        const app = buildTestApp(db, createMockAuth());

        // Act
        const res = await app.request("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: "" }),
        });

        // Assert
        expect(res.status).toBe(HTTP_UNPROCESSABLE_ENTITY);
        const body = (await res.json()) as {
          success: false;
          error: { code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("VALIDATION_FAILED");
      });
    });
  });

  describe("E2E フロー: サインイン → セッション確認 → リフレッシュ", () => {
    it("サインインからリフレッシュまでの一連のフローが成功すること", async () => {
      // Arrange
      const mockAuth = createMockAuth();
      const app = buildTestApp(db, mockAuth);

      // Act: Step 1 - サインイン
      const signInRes = await app.request("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: TEST_EMAIL, password: "Password123" }),
      });
      expect(signInRes.status).toBe(HTTP_OK);
      const signInBody = (await signInRes.json()) as {
        success: true;
        data: { session: { token: string; refreshToken: string } };
      };
      const token = signInBody.data.session.token;
      const refreshToken = signInBody.data.session.refreshToken;

      // Act: Step 2 - セッション確認
      const sessionRes = await app.request("/api/auth/session", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(sessionRes.status).toBe(HTTP_OK);
      const sessionBody = (await sessionRes.json()) as {
        success: true;
        data: { user: { email: string } };
      };
      expect(sessionBody.data.user.email).toBe(TEST_EMAIL);

      // Act: Step 3 - トークンリフレッシュ（refreshTokenはセッションID）
      const refreshRes = await app.request("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      expect(refreshRes.status).toBe(HTTP_OK);
      const refreshBody = (await refreshRes.json()) as {
        success: true;
        data: { token: string };
      };
      expect(refreshBody.data.token).toBeDefined();
    });
  });
});
