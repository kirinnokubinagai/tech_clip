const { mockLogger, mockCreateLogger } = vi.hoisted(() => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    withRequestId: vi.fn(),
  };
  logger.withRequestId.mockReturnValue(logger);

  return {
    mockLogger: logger,
    mockCreateLogger: vi.fn(() => logger),
  };
});

vi.mock("@api/lib/logger", () => ({
  createLogger: mockCreateLogger,
}));

import { createAiLimitMiddleware } from "@api/middleware/ai-limit";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** テスト用ユーザーID */
const TEST_USER_ID = "user_test_01";

/** テスト用プレミアムユーザーID */
const PREMIUM_USER_ID = "user_premium_01";

/** HTTP 402 Payment Required ステータスコード */
const HTTP_PAYMENT_REQUIRED = 402;

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

/** HTTP 401 Unauthorized ステータスコード */
const HTTP_UNAUTHORIZED = 401;

/** HTTP 400 Bad Request ステータスコード */
const HTTP_BAD_REQUEST = 400;

/** テスト用のフリーユーザーデータ */
function createFreeUserData(options?: { remaining?: number; resetAt?: string | null }) {
  return {
    id: TEST_USER_ID,
    email: "test@example.com",
    name: "テストユーザー",
    isPremium: false,
    freeAiUsesRemaining: options?.remaining ?? 5,
    freeAiResetAt: options?.resetAt ?? null,
  };
}

/** テスト用のプレミアムユーザーデータ */
function createPremiumUserData() {
  return {
    id: PREMIUM_USER_ID,
    email: "premium@example.com",
    name: "プレミアムユーザー",
    isPremium: true,
    freeAiUsesRemaining: 0,
    freeAiResetAt: null,
  };
}

/** モックの db.select クエリ結果 */
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn().mockReturnValue({
  where: mockSelectWhere,
});
const mockSelect = vi.fn().mockReturnValue({
  from: mockSelectFrom,
});

/** モックの db.update クエリ結果 */
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn().mockReturnValue({
  returning: mockUpdateReturning,
});
const mockUpdateSet = vi.fn().mockReturnValue({
  where: mockUpdateWhere,
});
const mockUpdate = vi.fn().mockReturnValue({
  set: mockUpdateSet,
});

/** モックのDBインスタンス */
const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};

/** HTTP 500 Internal Server Error ステータスコード */
const HTTP_INTERNAL_SERVER_ERROR = 500;

/**
 * SQL式のqueryChunksから文字列部分を連結して取得する
 *
 * Drizzle ORM の内部表現 `queryChunks` に依存しているため、メジャーアップデート時は
 * このヘルパーと関連アサーションの見直しが必要になる可能性がある。
 */
function extractSqlText(sqlExpression: { queryChunks: unknown[] }): string {
  return sqlExpression.queryChunks
    .flatMap((chunk) => {
      if (typeof chunk !== "object" || chunk === null || !("value" in chunk)) {
        return [];
      }
      const value = (chunk as { value?: unknown }).value;
      return Array.isArray(value) ? value.map((part) => String(part)) : [];
    })
    .join(" ");
}

/** テスト用のHonoアプリを作成する */
function createTestApp(userId?: string, downstreamStatus = HTTP_OK) {
  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  if (userId) {
    app.use("/ai/*", async (c, next) => {
      c.set("user", { id: userId });
      await next();
    });
  }

  app.use("/ai/*", createAiLimitMiddleware(mockDb as never));
  app.post("/ai/summarize", (c) => {
    if (downstreamStatus >= 400) {
      return c.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" },
        },
        downstreamStatus as 500,
      );
    }
    return c.json({ success: true, data: { summary: "テスト要約" } }, HTTP_OK);
  });

  return app;
}

/** 例外をスローするダウンストリームを持つテスト用Honoアプリを作成する */
function createThrowingTestApp(userId?: string) {
  const app = new Hono<{ Variables: { user?: Record<string, unknown> } }>();

  if (userId) {
    app.use("/ai/*", async (c, next) => {
      c.set("user", { id: userId });
      await next();
    });
  }

  app.onError(() => {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "サーバーエラーが発生しました",
        },
      }),
      {
        status: HTTP_INTERNAL_SERVER_ERROR,
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  app.use("/ai/*", createAiLimitMiddleware(mockDb as never));
  app.post("/ai/summarize", () => {
    throw new Error("ダウンストリームで予期しない例外が発生しました");
  });

  return app;
}

describe("aiLimitMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(mockLogger);
    mockLogger.withRequestId.mockReturnValue(mockLogger);
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockUpdateReturning.mockResolvedValue([{ id: TEST_USER_ID }]);
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
  });

  describe("無料ユーザー - 残回数あり", () => {
    it("残回数が1以上の場合リクエストが通過すること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("予約のためのdb.updateが1回呼ばれること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert: 成功時のみ1回更新される
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdateSet).toHaveBeenCalledTimes(1);
      expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
      expect(mockUpdateReturning).toHaveBeenCalledTimes(1);
    });
  });

  describe("無料ユーザー - 残回数なし", () => {
    it("残回数が0でリセット期限内の場合402が返ること", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: futureDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_PAYMENT_REQUIRED);
    });

    it("402レスポンスがAPI規約に従った形式であること", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: futureDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "AI_LIMIT_EXCEEDED",
          message:
            "無料のAI使用回数の上限に達しました。プレミアムプランにアップグレードしてください",
        },
      });
    });

    it("残回数が0でリセット期限内の場合db.updateが呼ばれないこと", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: futureDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("プレミアムユーザー", () => {
    it("プレミアムユーザーはfreeAiUsesRemainingに関係なくリクエストが通過すること", async () => {
      // Arrange
      const userData = createPremiumUserData();
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(PREMIUM_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("プレミアムユーザーの場合db.updateが呼ばれないこと", async () => {
      // Arrange
      const userData = createPremiumUserData();
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(PREMIUM_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("月次リセット", () => {
    it("freeAiResetAtが過去の場合リセットされて通過すること", async () => {
      // Arrange
      const pastDate = new Date("2025-01-01T00:00:00Z").toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: pastDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });

    it("リセット時にfreeAiUsesRemainingとfreeAiResetAtが更新されること", async () => {
      // Arrange
      const pastDate = new Date("2025-01-01T00:00:00Z").toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: pastDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdateSet).toHaveBeenCalledTimes(1);
      const setArg = mockUpdateSet.mock.calls[0][0];
      expect(setArg.freeAiUsesRemaining).toMatchObject({
        queryChunks: expect.any(Array),
      });
      expect(setArg.freeAiResetAt).toMatchObject({
        queryChunks: expect.any(Array),
      });
      expect(setArg.updatedAt).toEqual(expect.any(String));
      expect(mockUpdateReturning).toHaveBeenCalledTimes(1);
    });

    it("freeAiResetAtがnullの場合もリセットされて通過すること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 0, resetAt: null });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_OK);
    });
  });

  describe("未認証ユーザー", () => {
    it("contextにuser.idがセットされていない場合401が返ること", async () => {
      // Arrange
      const app = createTestApp();

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "ログインが必要です",
        },
      });
    });

    it("ユーザーがDBに存在しない場合401が返ること", async () => {
      // Arrange
      mockSelectWhere.mockResolvedValue([]);
      const app = createTestApp("nonexistent_user_id");

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(HTTP_UNAUTHORIZED);
    });
  });

  describe("TOCTOU競合（予約失敗）", () => {
    it("残回数ありでもreserveExistingFreeUseが失敗した場合に402が返ること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue([]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_PAYMENT_REQUIRED);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "AI_LIMIT_EXCEEDED",
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith("AIクォータ予約が競合で失敗しました", {
        userId: TEST_USER_ID,
        path: "existing-free-use",
      });
    });

    it("残回数ありでreserveExistingFreeUseが失敗した場合にdb.updateが1回だけ呼ばれること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue([]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert: 予約の試みは1回のみ。ロールバックは呼ばれない
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("リセット対象でもreserveResetFreeUseが失敗した場合に402が返ること", async () => {
      // Arrange
      const pastDate = new Date("2025-01-01T00:00:00Z").toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: pastDate });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue([]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_PAYMENT_REQUIRED);
      const body = await res.json();
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "AI_LIMIT_EXCEEDED",
        },
      });
      expect(mockLogger.warn).toHaveBeenCalledWith("AIクォータ予約が競合で失敗しました", {
        userId: TEST_USER_ID,
        path: "reset-free-use",
      });
    });

    it("リセット対象でreserveResetFreeUseが失敗した場合にdb.updateが1回だけ呼ばれること", async () => {
      // Arrange
      const pastDate = new Date("2025-01-01T00:00:00Z").toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: pastDate });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateReturning.mockResolvedValue([]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert: 予約の試みは1回のみ。ロールバックは呼ばれない
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe("ダウンストリーム失敗時", () => {
    it("ダウンストリームが500を返した場合に無料使用回数が消費されないこと", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID, HTTP_INTERNAL_SERVER_ERROR);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert: 予約とロールバックの2回更新される
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      const rollbackSetArg = mockUpdateSet.mock.calls[1][0] as {
        freeAiUsesRemaining: { queryChunks: unknown[] };
      };
      expect(extractSqlText(rollbackSetArg.freeAiUsesRemaining)).toContain("MIN(");
    });

    it("ダウンストリームが400を返した場合に無料使用回数が消費されないこと", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID, HTTP_BAD_REQUEST);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      const rollbackSetArg = mockUpdateSet.mock.calls[1][0] as {
        freeAiUsesRemaining: { queryChunks: unknown[] };
      };
      expect(extractSqlText(rollbackSetArg.freeAiUsesRemaining)).toContain("MIN(");
    });

    it("月次リセット対象でもダウンストリーム失敗時に無料使用回数が消費されないこと", async () => {
      // Arrange
      const pastDate = new Date("2025-01-01T00:00:00Z").toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: pastDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID, HTTP_INTERNAL_SERVER_ERROR);

      // Act
      await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      const rollbackSetArg = mockUpdateSet.mock.calls[1][0] as {
        freeAiUsesRemaining: { queryChunks: unknown[] };
      };
      expect(extractSqlText(rollbackSetArg.freeAiUsesRemaining)).toContain("MIN(");
    });
  });

  describe("レスポンス形式", () => {
    it("Content-Typeがapplication/jsonであること", async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: futureDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
      });

      // Assert
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });

  describe("ダウンストリーム例外スロー時", () => {
    it("ダウンストリームが例外をスローした場合にロールバックが呼ばれること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createThrowingTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "サーバーエラーが発生しました",
        },
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      const rollbackSetArg = mockUpdateSet.mock.calls[1][0] as {
        freeAiUsesRemaining: { queryChunks: unknown[] };
      };
      expect(extractSqlText(rollbackSetArg.freeAiUsesRemaining)).toContain("MIN(");
    });

    it("月次リセット対象でダウンストリームが例外をスローした場合もロールバックが呼ばれること", async () => {
      // Arrange
      const pastDate = new Date("2025-01-01T00:00:00Z").toISOString();
      const userData = createFreeUserData({ remaining: 0, resetAt: pastDate });
      mockSelectWhere.mockResolvedValue([userData]);
      const app = createThrowingTestApp(TEST_USER_ID);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json();

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      expect(body).toMatchObject({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "サーバーエラーが発生しました",
        },
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      const rollbackSetArg = mockUpdateSet.mock.calls[1][0] as {
        freeAiUsesRemaining: { queryChunks: unknown[] };
      };
      expect(extractSqlText(rollbackSetArg.freeAiUsesRemaining)).toContain("MIN(");
    });

    it("ロールバックが失敗してもリクエストがクラッシュせずerrorログが出ること", async () => {
      // Arrange
      const userData = createFreeUserData({ remaining: 3 });
      mockSelectWhere.mockResolvedValue([userData]);
      mockUpdateWhere
        .mockReturnValueOnce({ returning: mockUpdateReturning })
        .mockRejectedValueOnce(new Error("DB接続エラー"));
      mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);
      const app = createTestApp(TEST_USER_ID, HTTP_INTERNAL_SERVER_ERROR);

      // Act
      const res = await app.request("/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Assert
      expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
      expect(mockLogger.error).toHaveBeenCalledWith("AIクォータのロールバックに失敗しました", {
        userId: TEST_USER_ID,
        error: expect.any(Error),
      });
    });
  });
});

/** モックの db.insert チェーン */
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

/** fetchFn を注入したテスト用アプリ */
function createTestAppWithFetch(
  userId: string | undefined,
  downstreamStatus: number,
  fetchFn: typeof fetch,
  env?: { SENTRY_DSN?: string; ENVIRONMENT?: string },
) {
  const dbWithInsert = {
    ...mockDb,
    insert: mockInsert,
  };

  const app = new Hono<{
    Variables: { user?: Record<string, unknown> };
    Bindings: { SENTRY_DSN?: string; ENVIRONMENT?: string };
  }>();

  if (userId) {
    app.use("/ai/*", async (c, next) => {
      c.set("user", { id: userId });
      await next();
    });
  }

  app.use("/ai/*", createAiLimitMiddleware(dbWithInsert as never, { fetchFn }));
  app.post("/ai/summarize", (c) => {
    if (downstreamStatus >= 400) {
      return c.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" },
        },
        downstreamStatus as 500,
      );
    }
    return c.json({ success: true, data: { summary: "テスト要約" } }, HTTP_OK);
  });

  const bindings = env ?? {};

  return {
    request: (path: string, init?: RequestInit) => {
      const req = new Request(`http://localhost${path}`, init);
      return app.fetch(req, bindings);
    },
  };
}

describe("ロールバック失敗時の永続化", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLogger.mockReturnValue(mockLogger);
    mockLogger.withRequestId.mockReturnValue(mockLogger);
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockUpdateReturning.mockResolvedValue([{ id: TEST_USER_ID }]);
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockInsertValues.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockInsertValues });
  });

  it("rollbackError 発生時に ai_quota_rollback_failures への INSERT が呼ばれること", async () => {
    // Arrange
    const userData = createFreeUserData({ remaining: 3 });
    mockSelectWhere.mockResolvedValue([userData]);
    mockUpdateWhere
      .mockReturnValueOnce({ returning: mockUpdateReturning })
      .mockRejectedValueOnce(new Error("DB接続エラー"));
    mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);

    const app = createTestAppWithFetch(
      TEST_USER_ID,
      HTTP_INTERNAL_SERVER_ERROR,
      vi.fn() as never,
      {},
    );

    // Act
    await app.request("/ai/summarize", { method: "POST" });

    // Assert
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEST_USER_ID,
        reservationPath: "existing-free-use",
        errorMessage: "DB接続エラー",
      }),
    );
  });

  it("reservation_path が reset-free-use の場合に正しく記録されること", async () => {
    // Arrange
    const pastDate = new Date("2025-01-01T00:00:00Z").toISOString();
    const userData = createFreeUserData({ remaining: 0, resetAt: pastDate });
    mockSelectWhere.mockResolvedValue([userData]);
    mockUpdateWhere
      .mockReturnValueOnce({ returning: mockUpdateReturning })
      .mockRejectedValueOnce(new Error("DB接続エラー"));
    mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);

    const app = createTestAppWithFetch(
      TEST_USER_ID,
      HTTP_INTERNAL_SERVER_ERROR,
      vi.fn() as never,
      {},
    );

    // Act
    await app.request("/ai/summarize", { method: "POST" });

    // Assert
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationPath: "reset-free-use",
      }),
    );
  });

  it("永続化が失敗しても 500 レスポンスがクラッシュせず error ログが出ること", async () => {
    // Arrange
    const userData = createFreeUserData({ remaining: 3 });
    mockSelectWhere.mockResolvedValue([userData]);
    mockUpdateWhere
      .mockReturnValueOnce({ returning: mockUpdateReturning })
      .mockRejectedValueOnce(new Error("DB接続エラー"));
    mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);
    mockInsertValues.mockRejectedValue(new Error("INSERT失敗"));

    const app = createTestAppWithFetch(
      TEST_USER_ID,
      HTTP_INTERNAL_SERVER_ERROR,
      vi.fn() as never,
      {},
    );

    // Act
    const res = await app.request("/ai/summarize", { method: "POST" });

    // Assert
    expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "ロールバック失敗の永続化に失敗しました",
      expect.objectContaining({ userId: TEST_USER_ID }),
    );
  });

  it("エラーメッセージが 1024 文字に切り詰められること", async () => {
    // Arrange
    const userData = createFreeUserData({ remaining: 3 });
    mockSelectWhere.mockResolvedValue([userData]);
    const longError = new Error("a".repeat(2000));
    mockUpdateWhere
      .mockReturnValueOnce({ returning: mockUpdateReturning })
      .mockRejectedValueOnce(longError);
    mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);

    const app = createTestAppWithFetch(
      TEST_USER_ID,
      HTTP_INTERNAL_SERVER_ERROR,
      vi.fn() as never,
      {},
    );

    // Act
    await app.request("/ai/summarize", { method: "POST" });

    // Assert
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: "a".repeat(1024),
      }),
    );
  });
});

describe("ロールバック失敗時の Sentry 通知", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    mockCreateLogger.mockReturnValue(mockLogger);
    mockLogger.withRequestId.mockReturnValue(mockLogger);
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockUpdateReturning.mockResolvedValue([{ id: TEST_USER_ID }]);
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
    mockInsertValues.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockInsertValues });
  });

  it("ENVIRONMENT=production かつ SENTRY_DSN ありで fetch が Sentry エンドポイントに POST されること", async () => {
    // Arrange
    const userData = createFreeUserData({ remaining: 3 });
    mockSelectWhere.mockResolvedValue([userData]);
    mockUpdateWhere
      .mockReturnValueOnce({ returning: mockUpdateReturning })
      .mockRejectedValueOnce(new Error("DB接続エラー"));
    mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);

    const app = createTestAppWithFetch(
      TEST_USER_ID,
      HTTP_INTERNAL_SERVER_ERROR,
      mockFetch as never,
      {
        SENTRY_DSN: "https://key@sentry.io/123",
        ENVIRONMENT: "production",
      },
    );

    // Act
    await app.request("/ai/summarize", { method: "POST" });

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("123");
  });

  it("ENVIRONMENT=staging でも Sentry に送信されること", async () => {
    // Arrange
    const userData = createFreeUserData({ remaining: 3 });
    mockSelectWhere.mockResolvedValue([userData]);
    mockUpdateWhere
      .mockReturnValueOnce({ returning: mockUpdateReturning })
      .mockRejectedValueOnce(new Error("DB接続エラー"));
    mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);

    const app = createTestAppWithFetch(
      TEST_USER_ID,
      HTTP_INTERNAL_SERVER_ERROR,
      mockFetch as never,
      {
        SENTRY_DSN: "https://key@sentry.io/123",
        ENVIRONMENT: "staging",
      },
    );

    // Act
    await app.request("/ai/summarize", { method: "POST" });

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("ENVIRONMENT=development では SENTRY_DSN ありでも送信されないこと", async () => {
    // Arrange
    const userData = createFreeUserData({ remaining: 3 });
    mockSelectWhere.mockResolvedValue([userData]);
    mockUpdateWhere
      .mockReturnValueOnce({ returning: mockUpdateReturning })
      .mockRejectedValueOnce(new Error("DB接続エラー"));
    mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);

    const app = createTestAppWithFetch(
      TEST_USER_ID,
      HTTP_INTERNAL_SERVER_ERROR,
      mockFetch as never,
      {
        SENTRY_DSN: "https://key@sentry.io/123",
        ENVIRONMENT: "development",
      },
    );

    // Act
    await app.request("/ai/summarize", { method: "POST" });

    // Assert
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("SENTRY_DSN 未設定の場合は送信されないこと", async () => {
    // Arrange
    const userData = createFreeUserData({ remaining: 3 });
    mockSelectWhere.mockResolvedValue([userData]);
    mockUpdateWhere
      .mockReturnValueOnce({ returning: mockUpdateReturning })
      .mockRejectedValueOnce(new Error("DB接続エラー"));
    mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);

    const app = createTestAppWithFetch(
      TEST_USER_ID,
      HTTP_INTERNAL_SERVER_ERROR,
      mockFetch as never,
      {
        ENVIRONMENT: "production",
      },
    );

    // Act
    await app.request("/ai/summarize", { method: "POST" });

    // Assert
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("Sentry 送信が失敗してもクラッシュせず error ログが出ること", async () => {
    // Arrange
    const userData = createFreeUserData({ remaining: 3 });
    mockSelectWhere.mockResolvedValue([userData]);
    mockUpdateWhere
      .mockReturnValueOnce({ returning: mockUpdateReturning })
      .mockRejectedValueOnce(new Error("DB接続エラー"));
    mockUpdateReturning.mockResolvedValueOnce([{ id: TEST_USER_ID }]);
    mockFetch.mockRejectedValue(new Error("Sentry送信失敗"));

    const app = createTestAppWithFetch(
      TEST_USER_ID,
      HTTP_INTERNAL_SERVER_ERROR,
      mockFetch as never,
      {
        SENTRY_DSN: "https://key@sentry.io/123",
        ENVIRONMENT: "production",
      },
    );

    // Act
    const res = await app.request("/ai/summarize", { method: "POST" });

    // Assert
    expect(res.status).toBe(HTTP_INTERNAL_SERVER_ERROR);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Sentry 通知に失敗しました",
      expect.objectContaining({ userId: TEST_USER_ID }),
    );
  });
});
