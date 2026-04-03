import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPrompt,
  createTranslationJob,
  extractCodeBlocks,
  getTranslationJobStatus,
  parseTranslationResponse,
  restoreCodeBlocks,
  type TranslateOptions,
  translateArticle,
} from "./translator";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const RUNPOD_CONFIG = {
  apiKey: "test-runpod-api-key",
  endpointId: "test-endpoint-id",
};

describe("translator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extractCodeBlocks がコードブロックを抽出できること", () => {
    const result = extractCodeBlocks("text\n```ts\nconst x = 1;\n```\ntext");
    expect(result.blocks).toHaveLength(1);
    expect(result.text).toContain("{{CODE_BLOCK_0}}");
  });

  it("restoreCodeBlocks がコードブロックを復元できること", () => {
    const result = restoreCodeBlocks("{{CODE_BLOCK_0}}", ["```ts\nconst x = 1;\n```"]);
    expect(result).toContain("const x = 1");
  });

  it("buildPrompt が英語プロンプトを構築できること", () => {
    expect(buildPrompt("テスト", "en")).toContain("English");
  });

  it("parseTranslationResponse が RunPod 形式を読めること", () => {
    const response = {
      output: {
        choices: [{ message: { content: "Translated text" } }],
      },
    };
    expect(parseTranslationResponse(response)).toBe("Translated text");
  });

  it("createTranslationJob が RunPod job id を返すこと", async () => {
    const options: TranslateOptions = {
      title: "テスト",
      content: "テスト本文",
      targetLanguage: "en",
      runpodApiKey: RUNPOD_CONFIG.apiKey,
      runpodEndpointId: RUNPOD_CONFIG.endpointId,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "run_abc123" }),
    });

    const result = await createTranslationJob(options);
    expect(result.providerJobId).toBe("run_abc123");
  });

  it("getTranslationJobStatus が completed を返すこと", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "COMPLETED",
        output: {
          choices: [
            {
              message: {
                content:
                  '{"translatedTitle":"How to use React Hooks","translatedContent":"Text\\n\\n{{CODE_BLOCK_0}}"}',
              },
            },
          ],
        },
      }),
    });

    const result = await getTranslationJobStatus({
      providerJobId: "run_abc123",
      content: "テキスト\n\n```typescript\nconst x = 1;\n```",
      runpodApiKey: RUNPOD_CONFIG.apiKey,
      runpodEndpointId: RUNPOD_CONFIG.endpointId,
    });

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.translatedContent).toContain("```typescript");
    }
  });

  it("translateArticle が RunPod runsync を使って翻訳できること", async () => {
    const options: TranslateOptions = {
      title: "React Hooksの使い方",
      content: "# React Hooks\n\nテスト本文です。",
      targetLanguage: "en",
      runpodApiKey: RUNPOD_CONFIG.apiKey,
      runpodEndpointId: RUNPOD_CONFIG.endpointId,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            choices: [{ message: { content: "How to use React Hooks" } }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            choices: [{ message: { content: "# React Hooks\n\nTest body." } }],
          },
        }),
      });

    const result = await translateArticle(options);

    expect(result.translatedTitle).toBe("How to use React Hooks");
    expect(result.model).toBe("qwen3.5-9b");
  });
});
