import { createDbInitMiddleware } from "@api/middleware/db-init";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用DBモック */
const mockDb = { run: vi.fn(), select: vi.fn() };

/** テスト用Authモック */
const mockAuth = { api: { getSession: vi.fn() }, handler: vi.fn() };

/** モック createDatabase 関数 */
const mockCreateDatabase = vi.fn().mockReturnValue(mockDb);

/** モック createAuth 関数 */
const mockCreateAuth = vi.fn().mockReturnValue(mockAuth);

/** テスト用 Bindings */
type TestBindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  BETTER_AUTH_SECRET: string;
  APP_URL?: string;
  API_BASE_URL?: string;
  TRUSTED_ORIGINS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  MAILPIT_URL?: string;
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
};

/** テスト用 Variables */
type TestVariables = {
  db: typeof mockDb;
  auth: () => typeof mockAuth;
};

/**
 * テスト用 Hono アプリを生成する
 */
function createTestApp(env: Partial<TestBindings> = {}) {
  const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();

  const defaultEnv: TestBindings = {
    TURSO_DATABASE_URL: "libsql://test.turso.io",
    TURSO_AUTH_TOKEN: "test-token",
    BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
    ...env,
  };

  app.use(
    "/api/*",
    createDbInitMiddleware({
      createDatabaseFn: mockCreateDatabase,
      createAuthFn: mockCreateAuth,
    }),
  );

  app.get("/api/test", (c) => {
    const db = c.get("db");
    const getAuth = c.get("auth");
    return c.json({
      hasDb: db !== undefined,
      hasAuth: getAuth !== undefined,
      authIsFunction: typeof getAuth === "function",
    });
  });

  return { app, defaultEnv };
}

describe("createDbInitMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDatabase.mockReturnValue(mockDb);
    mockCreateAuth.mockReturnValue(mockAuth);
  });

  describe("db の初期化", () => {
    it("リクエストスコープで db が Context にセットされること", async () => {
      // Arrange
      const { app, defaultEnv } = createTestApp();

      // Act
      const res = await app.request("/api/test", {}, defaultEnv);
      const body = (await res.json()) as Record<string, unknown>;

      // Assert
      expect(body.hasDb).toBe(true);
    });

    it("createDatabase が正しい接続情報で呼び出されること", async () => {
      // Arrange
      const { app, defaultEnv } = createTestApp();

      // Act
      await app.request("/api/test", {}, defaultEnv);

      // Assert
      expect(mockCreateDatabase).toHaveBeenCalledWith({
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
      });
    });
  });

  describe("auth の初期化", () => {
    it("リクエストスコープで auth が Context にセットされること", async () => {
      // Arrange
      const { app, defaultEnv } = createTestApp();

      // Act
      const res = await app.request("/api/test", {}, defaultEnv);
      const body = (await res.json()) as Record<string, unknown>;

      // Assert
      expect(body.hasAuth).toBe(true);
    });

    it("auth が関数（ファクトリ）としてセットされること", async () => {
      // Arrange
      const { app, defaultEnv } = createTestApp();

      // Act
      const res = await app.request("/api/test", {}, defaultEnv);
      const body = (await res.json()) as Record<string, unknown>;

      // Assert
      expect(body.authIsFunction).toBe(true);
    });

    it("auth ファクトリを呼び出すと createAuth が実行されること", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();

      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });

      const defaultEnv: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
      };

      // Act
      await app.request("/api/test", {}, defaultEnv);
      const getAuth = capturedGetAuth[0];
      const result = getAuth();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledOnce();
      expect(result).toBe(mockAuth);
    });

    it("createAuth が db と secret で呼び出されること", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();

      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });

      const defaultEnv: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
      };

      // Act
      await app.request("/api/test", {}, defaultEnv);
      capturedGetAuth[0]();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledWith(
        mockDb,
        "test-secret-min-32-chars-long-enough!!",
        {},
        undefined,
        [],
        undefined,
        false,
      );
    });

    it("GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET が設定されている場合 createAuth に渡されること", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();

      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });

      const envWithGoogle: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
      };

      // Act
      await app.request("/api/test", {}, envWithGoogle);
      capturedGetAuth[0]();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledWith(
        mockDb,
        "test-secret-min-32-chars-long-enough!!",
        {
          google: {
            clientId: "google-client-id",
            clientSecret: "google-client-secret",
          },
        },
        undefined,
        [],
        undefined,
        false,
      );
    });

    it("API_BASE_URL が設定されている場合 createAuth に baseURL として渡されること", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();

      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });

      const envWithApiBaseUrl: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
        API_BASE_URL: "https://api.techclip.app",
      };

      // Act
      await app.request("/api/test", {}, envWithApiBaseUrl);
      capturedGetAuth[0]();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledWith(
        mockDb,
        "test-secret-min-32-chars-long-enough!!",
        {},
        "https://api.techclip.app",
        [],
        undefined,
        false,
      );
    });

    it("TRUSTED_ORIGINS が設定されている場合 createAuth にパース済み配列として渡されること", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();

      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });

      const envWithTrustedOrigins: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
        TRUSTED_ORIGINS: "https://staging.techclip.app,https://dev.techclip.app",
      };

      // Act
      await app.request("/api/test", {}, envWithTrustedOrigins);
      capturedGetAuth[0]();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledWith(
        mockDb,
        "test-secret-min-32-chars-long-enough!!",
        {},
        undefined,
        ["https://staging.techclip.app", "https://dev.techclip.app"],
        undefined,
        false,
      );
    });

    it("TRUSTED_ORIGINS が未設定の場合 createAuth に空配列が渡されること", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();

      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });

      const envWithoutTrustedOrigins: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
      };

      // Act
      await app.request("/api/test", {}, envWithoutTrustedOrigins);
      capturedGetAuth[0]();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledWith(
        mockDb,
        "test-secret-min-32-chars-long-enough!!",
        {},
        undefined,
        [],
        undefined,
        false,
      );
    });

    it("auth ファクトリを複数回呼び出しても createAuth は1回しか実行されないこと（メモ化）", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();

      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });

      const defaultEnv: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
      };

      // Act
      await app.request("/api/test", {}, defaultEnv);
      const getAuth = capturedGetAuth[0];
      const first = getAuth();
      const second = getAuth();
      const third = getAuth();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledOnce();
      expect(first).toBe(mockAuth);
      expect(second).toBe(mockAuth);
      expect(third).toBe(mockAuth);
    });
  });

  describe("ミドルウェア適用外のルート", () => {
    it("/api/* 以外のパスではミドルウェアが実行されないこと", async () => {
      // Arrange
      const { app, defaultEnv } = createTestApp();
      app.get("/health", (c) => c.json({ ok: true }));

      // Act
      await app.request("/health", {}, defaultEnv);

      // Assert
      expect(mockCreateDatabase).not.toHaveBeenCalled();
    });
  });

  describe("emailEnv の構築", () => {
    it("MAILPIT_URL が設定されている場合 emailEnv がオブジェクトとして渡されること", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();
      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });
      const envWithMailpit: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
        MAILPIT_URL: "http://localhost:8025/api/v1/send",
        FROM_EMAIL: "noreply@techclip.app",
      };

      // Act
      await app.request("/api/test", {}, envWithMailpit);
      capturedGetAuth[0]();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledWith(
        mockDb,
        "test-secret-min-32-chars-long-enough!!",
        {},
        undefined,
        [],
        {
          RESEND_API_KEY: "",
          FROM_EMAIL: "noreply@techclip.app",
          MAILPIT_URL: "http://localhost:8025/api/v1/send",
        },
        false,
      );
    });

    it("RESEND_API_KEY が設定されている場合 emailEnv がオブジェクトとして渡されること", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();
      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });
      const envWithResend: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
        RESEND_API_KEY: "re_test_key",
        FROM_EMAIL: "noreply@techclip.app",
      };

      // Act
      await app.request("/api/test", {}, envWithResend);
      capturedGetAuth[0]();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledWith(
        mockDb,
        "test-secret-min-32-chars-long-enough!!",
        {},
        undefined,
        [],
        {
          RESEND_API_KEY: "re_test_key",
          FROM_EMAIL: "noreply@techclip.app",
          MAILPIT_URL: undefined,
        },
        false,
      );
    });

    it("MAILPIT_URL も RESEND_API_KEY も未設定の場合 emailEnv が undefined になること", async () => {
      // Arrange
      const capturedGetAuth: Array<() => typeof mockAuth> = [];
      const app = new Hono<{ Bindings: TestBindings; Variables: TestVariables }>();
      app.use(
        "/api/*",
        createDbInitMiddleware({
          createDatabaseFn: mockCreateDatabase,
          createAuthFn: mockCreateAuth,
        }),
      );
      app.get("/api/test", (c) => {
        capturedGetAuth.push(c.get("auth"));
        return c.json({ ok: true });
      });
      const envWithoutEmail: TestBindings = {
        TURSO_DATABASE_URL: "libsql://test.turso.io",
        TURSO_AUTH_TOKEN: "test-token",
        BETTER_AUTH_SECRET: "test-secret-min-32-chars-long-enough!!",
      };

      // Act
      await app.request("/api/test", {}, envWithoutEmail);
      capturedGetAuth[0]();

      // Assert
      expect(mockCreateAuth).toHaveBeenCalledWith(
        mockDb,
        "test-secret-min-32-chars-long-enough!!",
        {},
        undefined,
        [],
        undefined,
        false,
      );
    });
  });
  describe("next() の呼び出し", () => {
    it("ミドルウェアが next を呼び出して後続処理が実行されること", async () => {
      // Arrange
      const { app, defaultEnv } = createTestApp();

      // Act
      const res = await app.request("/api/test", {}, defaultEnv);

      // Assert
      expect(res.status).toBe(200);
    });
  });
});
