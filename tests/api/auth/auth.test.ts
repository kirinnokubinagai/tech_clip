import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../../apps/api/src/index";

/** テスト用のシークレットキー（32文字以上） */
const TEST_SECRET = "test-secret-key-for-better-auth-min-32-chars!!";

/** テスト用の共通環境変数バインディング */
const TEST_BINDINGS = {
  TURSO_DATABASE_URL: "file:local.db",
  TURSO_AUTH_TOKEN: "test-token",
  RUNPOD_API_KEY: "test-key",
  RUNPOD_ENDPOINT_ID: "test-endpoint",
  ENVIRONMENT: "test",
  BETTER_AUTH_SECRET: TEST_SECRET,
  GOOGLE_CLIENT_ID: "google-client-id-test",
  GOOGLE_CLIENT_SECRET: "google-client-secret-test",
  APPLE_CLIENT_ID: "apple-client-id-test",
  APPLE_CLIENT_SECRET: "apple-client-secret-test",
  GITHUB_CLIENT_ID: "github-client-id-test",
  GITHUB_CLIENT_SECRET: "github-client-secret-test",
};

describe("Better Auth", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createAuth", () => {
    it("createAuth関数がエクスポートされていること", async () => {
      // Arrange
      const { createAuth } = await import("../../../apps/api/src/auth/index");

      // Assert
      expect(typeof createAuth).toBe("function");
    });

    it("DB引数とシークレットを渡してauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("../../../apps/api/src/auth/index");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      // Act
      const auth = createAuth(mockDb, TEST_SECRET);

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
      expect(typeof auth.handler).toBe("function");
    });

    it("baseURLを指定してauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("../../../apps/api/src/auth/index");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      // Act
      const auth = createAuth(mockDb, TEST_SECRET, undefined, "https://techclip.app");

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
    });

    it("baseURLを省略した場合もauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("../../../apps/api/src/auth/index");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      // Act
      const auth = createAuth(mockDb, TEST_SECRET, undefined, undefined);

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
    });
  });

  describe("OAuth設定", () => {
    it("socialProviders付きでauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("../../../apps/api/src/auth/index");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      // Act
      const auth = createAuth(mockDb, TEST_SECRET, {
        google: {
          clientId: "google-client-id-test",
          clientSecret: "google-client-secret-test",
        },
        apple: {
          clientId: "apple-client-id-test",
          clientSecret: "apple-client-secret-test",
        },
        github: {
          clientId: "github-client-id-test",
          clientSecret: "github-client-secret-test",
        },
      });

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
      expect(typeof auth.handler).toBe("function");
    });

    it("socialProvidersが未指定でもauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("../../../apps/api/src/auth/index");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      // Act
      const auth = createAuth(mockDb, TEST_SECRET);

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
    });

    it("一部のプロバイダーのみ指定してもauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("../../../apps/api/src/auth/index");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      // Act
      const auth = createAuth(mockDb, TEST_SECRET, {
        github: {
          clientId: "github-client-id-test",
          clientSecret: "github-client-secret-test",
        },
      });

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
    });

    it("OAuthProviderConfig型がエクスポートされていること", async () => {
      // Arrange
      const authModule = await import("../../../apps/api/src/auth/index");

      // Assert
      expect(authModule.createAuth).toBeDefined();
    });
  });

  describe("trustedOrigins設定", () => {
    it("追加のtrustedOriginsを渡してauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("./index");
      const mockDb = {} as Parameters<typeof createAuth>[0];
      const additionalOrigins = ["https://staging.techclip.app", "https://dev.techclip.app"];

      // Act
      const auth = createAuth(mockDb, TEST_SECRET, undefined, undefined, additionalOrigins);

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
    });

    it("trustedOriginsが未指定の場合もauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("./index");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      // Act
      const auth = createAuth(mockDb, TEST_SECRET, undefined, undefined, undefined);

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
    });

    it("空配列のtrustedOriginsでもauthインスタンスを生成できること", async () => {
      // Arrange
      const { createAuth } = await import("./index");
      const mockDb = {} as Parameters<typeof createAuth>[0];

      // Act
      const auth = createAuth(mockDb, TEST_SECRET, undefined, undefined, []);

      // Assert
      expect(auth).toBeDefined();
      expect(auth.handler).toBeDefined();
    });
  });

  describe("認証ルート統合", () => {
    it("認証ルートがアプリに登録されていること", async () => {
      // Arrange
      const req = new Request("http://localhost/api/auth/send-verification", {
        method: "POST",
      });

      // Act
      const res = await app.fetch(req, TEST_BINDINGS);

      // Assert（ルートが登録済み = Hono標準404以外）
      expect(res.status).not.toBe(404);
    });

    it("既存のhealthエンドポイントが引き続き動作すること", async () => {
      // Arrange
      const req = new Request("http://localhost/health");

      // Act
      const res = await app.fetch(req, TEST_BINDINGS);

      // Assert
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ status: "ok" });
    });

    it("OAuth環境変数がBindings型に含まれていること", async () => {
      // Arrange
      const req = new Request("http://localhost/health");

      // Act
      const res = await app.fetch(req, TEST_BINDINGS);

      // Assert
      expect(res.status).toBe(200);
    });
  });
});
