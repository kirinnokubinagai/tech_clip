import { createAuthRoute } from "@api/routes/auth";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** HTTP ステータスコード定数 */
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;

/** テスト用セッショントークン */
const MOCK_TOKEN = "integration-test-session-token-xyz";

/** 成功レスポンスの型定義 */
type SignOutSuccessBody = {
  success: true;
  data: null;
};

/** エラーレスポンスの型定義 */
type ErrorResponseBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

/**
 * index.ts の sign-out ルーティング構造を再現したテスト用アプリを生成する
 *
 * @param mockDb - モック DB インスタンス
 * @returns テスト用 Hono アプリ
 */
function createTestAppWithIndexRouting(mockDb: { delete: ReturnType<typeof vi.fn> }) {
  const mockAuth = {
    api: {
      signInEmail: vi.fn(),
      getSession: vi.fn(),
    },
  };

  const authRoute = createAuthRoute({
    db: mockDb as never,
    getAuth: () => mockAuth,
  });

  const app = new Hono();
  app.route("/api/auth", authRoute);
  return app;
}

describe("POST /api/auth/sign-out（統合テスト: index.ts 経由のルーティング検証）", () => {
  let deleteChain: { where: ReturnType<typeof vi.fn> };
  let mockDb: { delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    deleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDb = {
      delete: vi.fn().mockReturnValue(deleteChain),
    };
  });

  describe("正常系", () => {
    it("有効なBearerトークンでリクエストすると200が返ること", async () => {
      // Arrange
      const app = createTestAppWithIndexRouting(mockDb);
      const req = new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
      });

      // Act
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("正常なサインアウト時にレスポンスのsuccess.dataがtrueであること", async () => {
      // Arrange
      const app = createTestAppWithIndexRouting(mockDb);
      const req = new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as SignOutSuccessBody;

      // Assert
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });

    it("サインアウト時にDB sessions テーブルの delete が呼ばれること", async () => {
      // Arrange
      const app = createTestAppWithIndexRouting(mockDb);
      const req = new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: { Authorization: `Bearer ${MOCK_TOKEN}` },
      });

      // Act
      await app.fetch(req);

      // Assert
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
      expect(deleteChain.where).toHaveBeenCalledTimes(1);
    });
  });

  describe("異常系", () => {
    it("Authorizationヘッダーなしで401が返ること（catch-allに流れずに正しく処理されること）", async () => {
      // Arrange
      const app = createTestAppWithIndexRouting(mockDb);
      const req = new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });

    it("BearerではないAuthorizationヘッダーで401が返ること", async () => {
      // Arrange
      const app = createTestAppWithIndexRouting(mockDb);
      const req = new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });

      // Act
      const res = await app.fetch(req);
      const body = (await res.json()) as ErrorResponseBody;

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });
});
