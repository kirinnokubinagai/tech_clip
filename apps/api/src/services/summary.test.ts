import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SummaryResult } from "./summary";
import { createSummaryJob, getSummaryJobStatus, summarizeArticle } from "./summary";

const MOCK_RUNPOD_SUCCESS_RESPONSE = {
  id: "run_abc123",
  status: "COMPLETED",
  output: {
    text: "## 概要\nこの記事はTypeScriptの型システムについて解説しています。",
  },
};

const MOCK_CONTENT =
  "# TypeScriptの型システム入門\n\nTypeScriptは静的型付け言語です。ジェネリクスを使うことで再利用可能な型を定義できます。";

const MOCK_CONFIG = {
  apiKey: "test-runpod-api-key",
  endpointId: "test-endpoint-id",
};

const HTTP_OK = 200;

describe("summary service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("createSummaryJobがRunPodジョブIDを返すこと", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123" }), { status: HTTP_OK }),
      );

    const result = await createSummaryJob({
      content: MOCK_CONTENT,
      language: "ja",
      config: MOCK_CONFIG,
      fetchFn: mockFetch,
    });

    expect(result.providerJobId).toBe("run_abc123");
  });

  it("getSummaryJobStatusがcompletedを返すこと", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_RUNPOD_SUCCESS_RESPONSE), { status: HTTP_OK }),
      );

    const result = await getSummaryJobStatus({
      providerJobId: "run_abc123",
      config: MOCK_CONFIG,
      fetchFn: mockFetch,
    });

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.summary).toContain("TypeScript");
    }
  });

  it("summarizeArticleがRunPod APIを呼び出して要約を返すこと", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123" }), { status: HTTP_OK }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_RUNPOD_SUCCESS_RESPONSE), { status: HTTP_OK }),
      );

    const result = await summarizeArticle({
      content: MOCK_CONTENT,
      language: "ja",
      config: MOCK_CONFIG,
      fetchFn: mockFetch,
    });

    expect(result.summary).toContain("TypeScript");
    expect(result.model).toBe("qwen3.5-9b");
  });

  it("戻り値がSummaryResult型であること", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "run_abc123" }), { status: HTTP_OK }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(MOCK_RUNPOD_SUCCESS_RESPONSE), { status: HTTP_OK }),
      );

    const result: SummaryResult = await summarizeArticle({
      content: MOCK_CONTENT,
      language: "ja",
      config: MOCK_CONFIG,
      fetchFn: mockFetch,
    });

    expect(typeof result.summary).toBe("string");
    expect(typeof result.model).toBe("string");
  });
});
