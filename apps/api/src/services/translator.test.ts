import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type TranslateOptions,
  type TranslationResult,
  buildPrompt,
  extractCodeBlocks,
  parseTranslationResponse,
  restoreCodeBlocks,
  translateArticle,
} from "./translator";

/** グローバルfetchのモック */
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/** テスト用RunPod設定 */
const RUNPOD_CONFIG = {
  apiKey: "test-runpod-api-key",
  endpointId: "test-endpoint-id",
};

/** テスト用記事コンテンツ */
const MOCK_CONTENT_JA =
  "# React Hooksの使い方\n\nReact Hooksは関数コンポーネントで状態管理を行うための仕組みです。\n\n```typescript\nconst [count, setCount] = useState(0);\n```\n\n上記のコードでは`useState`を使用しています。";

/** テスト用記事コンテンツ（英語） */
const MOCK_CONTENT_EN =
  "# How to use React Hooks\n\nReact Hooks is a mechanism for state management in functional components.\n\n```typescript\nconst [count, setCount] = useState(0);\n```\n\nThe code above uses `useState`.";

/** テスト用の翻訳済みタイトル */
const MOCK_TRANSLATED_TITLE = "How to use React Hooks";

/** テスト用の翻訳済みコンテンツ */
const MOCK_TRANSLATED_CONTENT =
  "# How to use React Hooks\n\nReact Hooks is a mechanism for state management in functional components.\n\n```typescript\nconst [count, setCount] = useState(0);\n```\n\nThe code above uses `useState`.";

describe("translator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractCodeBlocks", () => {
    it("コードブロックを正しく抽出できること", () => {
      // Arrange
      const text =
        "テキスト\n\n```typescript\nconst x = 1;\n```\n\nテキスト\n\n```javascript\nlet y = 2;\n```";

      // Act
      const result = extractCodeBlocks(text);

      // Assert
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks[0]).toBe("```typescript\nconst x = 1;\n```");
      expect(result.blocks[1]).toBe("```javascript\nlet y = 2;\n```");
      expect(result.text).toContain("{{CODE_BLOCK_0}}");
      expect(result.text).toContain("{{CODE_BLOCK_1}}");
      expect(result.text).not.toContain("const x = 1");
    });

    it("コードブロックがない場合に空配列を返すこと", () => {
      // Arrange
      const text = "コードブロックのないテキスト";

      // Act
      const result = extractCodeBlocks(text);

      // Assert
      expect(result.blocks).toHaveLength(0);
      expect(result.text).toBe("コードブロックのないテキスト");
    });

    it("インラインコードは抽出しないこと", () => {
      // Arrange
      const text = "テキスト `inline code` テキスト";

      // Act
      const result = extractCodeBlocks(text);

      // Assert
      expect(result.blocks).toHaveLength(0);
      expect(result.text).toContain("`inline code`");
    });
  });

  describe("restoreCodeBlocks", () => {
    it("プレースホルダーをコードブロックに復元できること", () => {
      // Arrange
      const text = "Translated text\n\n{{CODE_BLOCK_0}}\n\nMore text\n\n{{CODE_BLOCK_1}}";
      const blocks = ["```typescript\nconst x = 1;\n```", "```javascript\nlet y = 2;\n```"];

      // Act
      const result = restoreCodeBlocks(text, blocks);

      // Assert
      expect(result).toContain("```typescript\nconst x = 1;\n```");
      expect(result).toContain("```javascript\nlet y = 2;\n```");
      expect(result).not.toContain("{{CODE_BLOCK_0}}");
      expect(result).not.toContain("{{CODE_BLOCK_1}}");
    });

    it("コードブロックがない場合にテキストをそのまま返すこと", () => {
      // Arrange
      const text = "No code blocks here";

      // Act
      const result = restoreCodeBlocks(text, []);

      // Assert
      expect(result).toBe("No code blocks here");
    });
  });

  describe("buildPrompt", () => {
    it("日本語から英語への翻訳プロンプトを生成できること", () => {
      // Arrange
      const text = "テストテキスト";
      const targetLanguage = "en";

      // Act
      const result = buildPrompt(text, targetLanguage);

      // Assert
      expect(result).toContain("English");
      expect(result).toContain("テストテキスト");
      expect(result).toContain("{{CODE_BLOCK_");
    });

    it("英語から日本語への翻訳プロンプトを生成できること", () => {
      // Arrange
      const text = "Test text";
      const targetLanguage = "ja";

      // Act
      const result = buildPrompt(text, targetLanguage);

      // Assert
      expect(result).toContain("Japanese");
      expect(result).toContain("Test text");
    });
  });

  describe("parseTranslationResponse", () => {
    it("正常なレスポンスからテキストを抽出できること", () => {
      // Arrange
      const response = {
        output: {
          choices: [
            {
              message: {
                content: "Translated text here",
              },
            },
          ],
        },
      };

      // Act
      const result = parseTranslationResponse(response);

      // Assert
      expect(result).toBe("Translated text here");
    });

    it("不正なレスポンス形式でエラーを返すこと", () => {
      // Arrange
      const response = { output: {} };

      // Act & Assert
      expect(() => parseTranslationResponse(response)).toThrow(
        "翻訳レスポンスの解析に失敗しました",
      );
    });

    it("空のchoicesでエラーを返すこと", () => {
      // Arrange
      const response = { output: { choices: [] } };

      // Act & Assert
      expect(() => parseTranslationResponse(response)).toThrow(
        "翻訳レスポンスの解析に失敗しました",
      );
    });
  });

  describe("translateArticle", () => {
    it("日本語記事を英語に翻訳できること", async () => {
      // Arrange
      const options: TranslateOptions = {
        title: "React Hooksの使い方",
        content: MOCK_CONTENT_JA,
        targetLanguage: "en",
        runpodApiKey: RUNPOD_CONFIG.apiKey,
        runpodEndpointId: RUNPOD_CONFIG.endpointId,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            output: {
              choices: [{ message: { content: MOCK_TRANSLATED_TITLE } }],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            output: {
              choices: [{ message: { content: MOCK_TRANSLATED_CONTENT } }],
            },
          }),
        });

      // Act
      const result = await translateArticle(options);

      // Assert
      expect(result.translatedTitle).toBe(MOCK_TRANSLATED_TITLE);
      expect(result.translatedContent).toContain("React Hooks");
      expect(result.model).toBe("qwen3.5-9b");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("RunPod APIへのリクエストが正しい形式であること", async () => {
      // Arrange
      const options: TranslateOptions = {
        title: "テスト",
        content: "テストコンテンツ",
        targetLanguage: "en",
        runpodApiKey: RUNPOD_CONFIG.apiKey,
        runpodEndpointId: RUNPOD_CONFIG.endpointId,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          output: {
            choices: [{ message: { content: "Translated" } }],
          },
        }),
      });

      // Act
      await translateArticle(options);

      // Assert
      const [url, fetchOptions] = mockFetch.mock.calls[0];
      expect(url).toContain(RUNPOD_CONFIG.endpointId);
      expect(url).toContain("runsync");
      const body = JSON.parse(fetchOptions.body as string);
      expect(body.input).toBeDefined();
      expect(fetchOptions.headers).toMatchObject({
        Authorization: `Bearer ${RUNPOD_CONFIG.apiKey}`,
        "Content-Type": "application/json",
      });
    });

    it("コードブロックが翻訳されずに保持されること", async () => {
      // Arrange
      const contentWithCode = "テキスト\n\n```typescript\nconst x = 1;\n```\n\nテキスト";
      const options: TranslateOptions = {
        title: "テスト",
        content: contentWithCode,
        targetLanguage: "en",
        runpodApiKey: RUNPOD_CONFIG.apiKey,
        runpodEndpointId: RUNPOD_CONFIG.endpointId,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            output: {
              choices: [{ message: { content: "Test" } }],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            output: {
              choices: [
                {
                  message: {
                    content: "Text\n\n{{CODE_BLOCK_0}}\n\nText",
                  },
                },
              ],
            },
          }),
        });

      // Act
      const result = await translateArticle(options);

      // Assert
      expect(result.translatedContent).toContain("```typescript\nconst x = 1;\n```");
    });

    it("APIエラー時に適切なエラーをスローすること", async () => {
      // Arrange
      const options: TranslateOptions = {
        title: "テスト",
        content: "テスト",
        targetLanguage: "en",
        runpodApiKey: RUNPOD_CONFIG.apiKey,
        runpodEndpointId: RUNPOD_CONFIG.endpointId,
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      // Act & Assert
      await expect(translateArticle(options)).rejects.toThrow("RunPod APIリクエストに失敗しました");
    });

    it("ネットワークエラー時に適切なエラーをスローすること", async () => {
      // Arrange
      const options: TranslateOptions = {
        title: "テスト",
        content: "テスト",
        targetLanguage: "en",
        runpodApiKey: RUNPOD_CONFIG.apiKey,
        runpodEndpointId: RUNPOD_CONFIG.endpointId,
      };

      mockFetch.mockRejectedValue(new Error("Network error"));

      // Act & Assert
      await expect(translateArticle(options)).rejects.toThrow("翻訳処理に失敗しました");
    });
  });
});
