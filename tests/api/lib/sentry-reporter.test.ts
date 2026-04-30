import { notifyError } from "@api/lib/sentry-reporter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** fetch のモック型 */
type MockFetch = ReturnType<typeof vi.fn>;

describe("notifyError", () => {
  let fetchMock: MockFetch;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("送信スキップ条件", () => {
    it("SENTRY_DSN が未設定なら何もしないこと", async () => {
      // Arrange & Act
      await notifyError(
        { SENTRY_DSN: undefined, ENVIRONMENT: "production" },
        new Error("test"),
        {},
        fetchMock as typeof fetch,
      );

      // Assert
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("ENVIRONMENT が development の場合に何もしないこと", async () => {
      // Arrange & Act
      await notifyError(
        { SENTRY_DSN: "https://key@sentry.io/123", ENVIRONMENT: "development" },
        new Error("test"),
        {},
        fetchMock as typeof fetch,
      );

      // Assert
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("ENVIRONMENT が test の場合に何もしないこと", async () => {
      // Arrange & Act
      await notifyError(
        { SENTRY_DSN: "https://key@sentry.io/123", ENVIRONMENT: "test" },
        new Error("test"),
        {},
        fetchMock as typeof fetch,
      );

      // Assert
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("ENVIRONMENT が undefined の場合に何もしないこと", async () => {
      // Arrange & Act
      await notifyError(
        { SENTRY_DSN: "https://key@sentry.io/123", ENVIRONMENT: undefined },
        new Error("test"),
        {},
        fetchMock as typeof fetch,
      );

      // Assert
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("Sentry 送信", () => {
    it("ENVIRONMENT が production で fetch が呼ばれること", async () => {
      // Arrange & Act
      await notifyError(
        { SENTRY_DSN: "https://key@sentry.io/123", ENVIRONMENT: "production" },
        new Error("テストエラー"),
        {},
        fetchMock as typeof fetch,
      );

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("sentry.io");
      expect(url).toContain("/api/");
      expect(url).toContain("/store/");
      expect((options as RequestInit).method).toBe("POST");
    });

    it("ENVIRONMENT が staging で fetch が呼ばれること", async () => {
      // Arrange & Act
      await notifyError(
        { SENTRY_DSN: "https://key@sentry.io/123", ENVIRONMENT: "staging" },
        new Error("テストエラー"),
        {},
        fetchMock as typeof fetch,
      );

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("tags が Sentry event payload に含まれること", async () => {
      // Arrange
      const tags = { source: "ai-limit-rollback", user_id: "user-123" };

      // Act
      await notifyError(
        { SENTRY_DSN: "https://key@sentry.io/123", ENVIRONMENT: "production" },
        new Error("テストエラー"),
        tags,
        fetchMock as typeof fetch,
      );

      // Assert
      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse((options as RequestInit).body as string) as Record<string, unknown>;
      expect(body.tags).toMatchObject(tags);
    });

    it("エラーメッセージが payload に含まれること", async () => {
      // Arrange & Act
      await notifyError(
        { SENTRY_DSN: "https://key@sentry.io/123", ENVIRONMENT: "production" },
        new Error("エラーメッセージ"),
        {},
        fetchMock as typeof fetch,
      );

      // Assert
      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse((options as RequestInit).body as string) as {
        exception: { values: Array<{ value: string }> };
      };
      expect(body.exception.values[0].value).toBe("エラーメッセージ");
    });

    it("DSN 解析失敗時に何もしないこと", async () => {
      // Arrange & Act
      await notifyError(
        { SENTRY_DSN: "not-a-valid-dsn", ENVIRONMENT: "production" },
        new Error("test"),
        {},
        fetchMock as typeof fetch,
      );

      // Assert
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("fire-and-forget", () => {
    it("Sentry 送信が失敗（fetch reject）しても例外を投げないこと", async () => {
      // Arrange
      fetchMock.mockRejectedValue(new Error("network error"));

      // Act & Assert: should not throw
      await expect(
        notifyError(
          { SENTRY_DSN: "https://key@sentry.io/123", ENVIRONMENT: "production" },
          new Error("test"),
          {},
          fetchMock as typeof fetch,
        ),
      ).resolves.toBeUndefined();
    });
  });
});
