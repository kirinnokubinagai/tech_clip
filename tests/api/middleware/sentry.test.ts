import { createSentryMiddleware } from "@api/middleware/sentry";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** fetch のモック型 */
type MockFetch = ReturnType<typeof vi.fn>;

type Bindings = {
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
};

/** テスト用 Hono アプリを作成する */
function createTestApp(sentryDsn: string | undefined, fetchMock: MockFetch, environment?: string) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use("*", createSentryMiddleware(fetchMock as typeof fetch));

  app.get("/ok", (c) => c.json({ ok: true }));

  app.get("/error", () => {
    throw new Error("テストエラー");
  });

  app.get("/custom-error", () => {
    const err = new Error("カスタムエラーメッセージ");
    err.name = "CustomError";
    throw err;
  });

  return {
    request: (path: string, init?: RequestInit) => {
      const req = new Request(`http://localhost${path}`, init);
      return app.fetch(req, { SENTRY_DSN: sentryDsn, ENVIRONMENT: environment } as Bindings);
    },
  };
}

describe("createSentryMiddleware", () => {
  let fetchMock: MockFetch;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("正常系リクエスト", () => {
    it("エラーがない場合はSentryにイベントを送信しないこと", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      const res = await app.request("/ok");

      // Assert
      expect(res.status).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("エラーキャプチャ", () => {
    it("エラー発生時にSentryエンドポイントへfetchを呼ぶこと", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      const res = await app.request("/error");

      // Assert
      expect(res.status).toBe(500);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("SentryエンドポイントURLが正しいこと", async () => {
      // Arrange
      const dsn = "https://publickey@o123.ingest.sentry.io/456";
      const app = createTestApp(dsn, fetchMock, "production");

      // Act
      await app.request("/error");

      // Assert
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("sentry.io");
      expect(calledUrl).toContain("/api/");
      expect(calledUrl).toContain("/store/");
    });

    it("SentryにPOSTリクエストを送信すること", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      await app.request("/error");

      // Assert
      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      expect(callOptions.method).toBe("POST");
    });

    it("リクエストボディにエラーメッセージが含まれること", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      await app.request("/error");

      // Assert
      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callOptions.body as string) as Record<string, unknown>;
      const exception = body.exception as {
        values: Array<{ value: string; type: string }>;
      };
      expect(exception.values[0].value).toBe("テストエラー");
    });

    it("リクエストボディにエラー型が含まれること", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      await app.request("/custom-error");

      // Assert
      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callOptions.body as string) as Record<string, unknown>;
      const exception = body.exception as {
        values: Array<{ value: string; type: string }>;
      };
      expect(exception.values[0].type).toBe("CustomError");
    });

    it("Content-Typeヘッダーがapplication/jsonであること", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      await app.request("/error");

      // Assert
      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = callOptions.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("X-Sentry-Authヘッダーが設定されていること", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      await app.request("/error");

      // Assert
      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      const headers = callOptions.headers as Record<string, string>;
      expect(headers["X-Sentry-Auth"]).toBeDefined();
      expect(headers["X-Sentry-Auth"]).toContain("Sentry ");
      expect(headers["X-Sentry-Auth"]).toContain("sentry_key=");
    });

    it("送信ボディに environment フィールドが含まれること", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      await app.request("/error");

      // Assert
      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callOptions.body as string) as Record<string, unknown>;
      expect(body.environment).toBe("production");
    });
  });

  describe("SENTRY_DSN未設定", () => {
    it("SENTRY_DSNが未設定の場合はエラーをキャプチャせずにスルーすること", async () => {
      // Arrange
      const app = createTestApp(undefined, fetchMock, "production");

      // Act
      const res = await app.request("/error");

      // Assert
      expect(res.status).toBe(500);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("環境別ガード", () => {
    it("ENVIRONMENT=development の場合 fetchFn が呼ばれないこと", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "development");

      // Act
      await app.request("/error");

      // Assert
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("ENVIRONMENT=production の場合 fetchFn が呼ばれること", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      await app.request("/error");

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("ENVIRONMENT=staging の場合 fetchFn が呼ばれること", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "staging");

      // Act
      await app.request("/error");

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("ENVIRONMENT=undefined の場合 fetchFn が呼ばれないこと", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, undefined);

      // Act
      await app.request("/error");

      // Assert
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("staging 環境で送信ボディに environment=staging が含まれること", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "staging");

      // Act
      await app.request("/error");

      // Assert
      const callOptions = fetchMock.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callOptions.body as string) as Record<string, unknown>;
      expect(body.environment).toBe("staging");
    });
  });

  describe("エラーの再スロー", () => {
    it("エラーをキャプチャした後もレスポンスは500を返すこと", async () => {
      // Arrange
      const app = createTestApp("https://key@sentry.io/123", fetchMock, "production");

      // Act
      const res = await app.request("/error");

      // Assert
      expect(res.status).toBe(500);
    });
  });

  describe("DSN解析", () => {
    it("プロジェクトIDがURLに含まれること", async () => {
      // Arrange
      const app = createTestApp("https://abc123@sentry.io/789", fetchMock, "production");

      // Act
      await app.request("/error");

      // Assert
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("789");
    });
  });
});

import { captureError } from "@api/middleware/sentry";

describe("captureError (直接呼び出し)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("有効な DSN でエラーを送信すると Sentry エンドポイントに POST されること", async () => {
    // Arrange
    const dsn = "https://testkey@sentry.io/12345";
    const error = new Error("直接呼び出しテストエラー");

    // Act
    await captureError(dsn, error, fetchMock as typeof fetch, "production");

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("12345");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.exception).toBeDefined();
    expect((body.exception as { values: Array<{ value: string }> }).values[0].value).toBe(
      "直接呼び出しテストエラー",
    );
  });

  it("無効な DSN の場合は送信されないこと", async () => {
    // Arrange
    const invalidDsn = "not-a-valid-dsn";
    const error = new Error("テストエラー");

    // Act
    await captureError(invalidDsn, error, fetchMock as typeof fetch);

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
