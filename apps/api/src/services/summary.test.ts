import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SummaryResult } from "./summary";
import { summarizeArticle } from "./summary";

/** テスト用のRunPod APIレスポンス */
const MOCK_RUNPOD_SUCCESS_RESPONSE = {
  id: "run_abc123",
  status: "COMPLETED",
  output: {
    text: "## 概要\nこの記事はTypeScriptの型システムについて解説しています。\n\n## キーポイント\n- 型推論の仕組み\n- ジェネリクスの活用法\n- 型ガードパターン",
  },
};

/** テスト用の記事コンテンツ */
const MOCK_CONTENT =
  "# TypeScriptの型システム入門\n\nTypeScriptは静的型付け言語です。型推論により多くの場合型を明示的に書く必要がありません。ジェネリクスを使うことで再利用可能な型を定義できます。型ガードを使うことで実行時に型を絞り込むことができます。";

/** テスト用のRunPod設定 */
const MOCK_CONFIG = {
  apiKey: "test-runpod-api-key",
  endpointId: "test-endpoint-id",
};

/** HTTP 200 OK ステータスコード */
const HTTP_OK = 200;

describe("summarizeArticle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("RunPod APIを呼び出して要約を返すこと", async () => {
    // Arrange
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123", status: "IN_QUEUE" }), {
          status: HTTP_OK,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_RUNPOD_SUCCESS_RESPONSE), {
          status: HTTP_OK,
        }),
      );

    // Act
    const result = await summarizeArticle({
      content: MOCK_CONTENT,
      language: "ja",
      config: MOCK_CONFIG,
      fetchFn: mockFetch,
    });

    // Assert
    expect(result.summary).toContain("TypeScript");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("言語パラメータに応じたプロンプトを送信すること", async () => {
    // Arrange
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123", status: "IN_QUEUE" }), {
          status: HTTP_OK,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_RUNPOD_SUCCESS_RESPONSE), {
          status: HTTP_OK,
        }),
      );

    // Act
    await summarizeArticle({
      content: MOCK_CONTENT,
      language: "en",
      config: MOCK_CONFIG,
      fetchFn: mockFetch,
    });

    // Assert
    const firstCallArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(firstCallArgs[1].body as string);
    expect(requestBody.input.prompt).toContain("English");
  });

  it("コンテンツが長い場合に切り詰めて送信すること", async () => {
    // Arrange
    const longContent = "a".repeat(50000);
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123", status: "IN_QUEUE" }), {
          status: HTTP_OK,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_RUNPOD_SUCCESS_RESPONSE), {
          status: HTTP_OK,
        }),
      );

    // Act
    await summarizeArticle({
      content: longContent,
      language: "ja",
      config: MOCK_CONFIG,
      fetchFn: mockFetch,
    });

    // Assert
    const firstCallArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(firstCallArgs[1].body as string);
    expect(requestBody.input.prompt.length).toBeLessThan(longContent.length);
  });

  it("RunPod APIがエラーを返した場合にエラーをスローすること", async () => {
    // Arrange
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
      }),
    );

    // Act & Assert
    await expect(
      summarizeArticle({
        content: MOCK_CONTENT,
        language: "ja",
        config: MOCK_CONFIG,
        fetchFn: mockFetch,
      }),
    ).rejects.toThrow("要約の生成に失敗しました");
  });

  it("ネットワークエラーの場合にエラーをスローすること", async () => {
    // Arrange
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    // Act & Assert
    await expect(
      summarizeArticle({
        content: MOCK_CONTENT,
        language: "ja",
        config: MOCK_CONFIG,
        fetchFn: mockFetch,
      }),
    ).rejects.toThrow("要約の生成に失敗しました");
  });

  it("ポーリング中にステータスAPIがエラーを返した場合にエラーをスローすること", async () => {
    // Arrange
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123", status: "IN_QUEUE" }), {
          status: HTTP_OK,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Internal Server Error" }), {
          status: 500,
        }),
      );

    // Act & Assert
    await expect(
      summarizeArticle({
        content: MOCK_CONTENT,
        language: "ja",
        config: MOCK_CONFIG,
        fetchFn: mockFetch,
      }),
    ).rejects.toThrow("要約の生成に失敗しました");
  });

  it("ジョブがFAILEDステータスになった場合にエラーをスローすること", async () => {
    // Arrange
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123", status: "IN_QUEUE" }), {
          status: HTTP_OK,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "FAILED" }), {
          status: HTTP_OK,
        }),
      );

    // Act & Assert
    await expect(
      summarizeArticle({
        content: MOCK_CONTENT,
        language: "ja",
        config: MOCK_CONFIG,
        fetchFn: mockFetch,
      }),
    ).rejects.toThrow("要約の生成に失敗しました");
  });

  it("ポーリング回数上限に達した場合にタイムアウトエラーをスローすること", async () => {
    // Arrange: 常にIN_QUEUEを返す（COMPLETEDにならない）
    const inQueueResponse = new Response(JSON.stringify({ status: "IN_QUEUE" }), {
      status: HTTP_OK,
    });
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123", status: "IN_QUEUE" }), {
          status: HTTP_OK,
        }),
      )
      .mockResolvedValue(inQueueResponse);

    vi.useFakeTimers();

    // Act & Assert: expectでwrapしてからタイマーを進める
    const assertion = expect(
      summarizeArticle({
        content: MOCK_CONTENT,
        language: "ja",
        config: MOCK_CONFIG,
        fetchFn: mockFetch,
      }),
    ).rejects.toThrow("要約の生成に失敗しました");

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    await assertion;
  }, 10000);

  it("戻り値がSummaryResult型であること", async () => {
    // Arrange
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123", status: "IN_QUEUE" }), {
          status: HTTP_OK,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_RUNPOD_SUCCESS_RESPONSE), {
          status: HTTP_OK,
        }),
      );

    // Act
    const result: SummaryResult = await summarizeArticle({
      content: MOCK_CONTENT,
      language: "ja",
      config: MOCK_CONFIG,
      fetchFn: mockFetch,
    });

    // Assert
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("model");
    expect(typeof result.summary).toBe("string");
    expect(typeof result.model).toBe("string");
  });
});
