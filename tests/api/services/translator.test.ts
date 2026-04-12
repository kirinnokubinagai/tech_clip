import { DEFAULT_GEMMA_MODEL_TAG } from "@api/lib/ai-model";
import {
  buildPrompt,
  extractCodeBlocks,
  parseTranslationResponse,
  restoreCodeBlocks,
  translateArticle,
} from "@api/services/translator";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Workers AI モックオブジェクト */
const mockAi = {
  run: vi.fn(),
};

describe("translator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractCodeBlocks", () => {
    it("コードブロックを抽出できること", () => {
      // Arrange
      const text = "text\n```ts\nconst x = 1;\n```\ntext";

      // Act
      const result = extractCodeBlocks(text);

      // Assert
      expect(result.blocks).toHaveLength(1);
      expect(result.text).toContain("{{CODE_BLOCK_0}}");
    });

    it("コードブロックがない場合は空の配列を返すこと", () => {
      // Arrange
      const text = "テキストのみ";

      // Act
      const result = extractCodeBlocks(text);

      // Assert
      expect(result.blocks).toHaveLength(0);
      expect(result.text).toBe(text);
    });
  });

  describe("restoreCodeBlocks", () => {
    it("コードブロックを復元できること", () => {
      // Arrange
      const text = "{{CODE_BLOCK_0}}";
      const blocks = ["```ts\nconst x = 1;\n```"];

      // Act
      const result = restoreCodeBlocks(text, blocks);

      // Assert
      expect(result).toContain("const x = 1");
    });
  });

  describe("buildPrompt", () => {
    it("英語翻訳プロンプトを構築できること", () => {
      // Arrange / Act
      const result = buildPrompt({
        content: "テスト",
        title: "タイトル",
        targetLanguage: "en",
      });

      // Assert
      expect(result).toBeInstanceOf(Array);
      const userMessage = result.find((m) => m.role === "user");
      expect(userMessage?.content).toContain("English");
    });

    it("日本語翻訳プロンプトを構築できること", () => {
      // Arrange / Act
      const result = buildPrompt({
        content: "Test content",
        title: "Title",
        targetLanguage: "ja",
      });

      // Assert
      const userMessage = result.find((m) => m.role === "user");
      expect(userMessage?.content).toContain("Japanese");
    });

    it("中国語翻訳プロンプトを構築できること", () => {
      // Arrange / Act
      const result = buildPrompt({
        content: "Test content",
        title: "Title",
        targetLanguage: "zh",
      });

      // Assert
      const userMessage = result.find((m) => m.role === "user");
      expect(userMessage?.content).toContain("Chinese");
    });

    it("簡体字中国語翻訳プロンプトを構築できること", () => {
      // Arrange / Act
      const result = buildPrompt({
        content: "Test content",
        title: "Title",
        targetLanguage: "zh-CN",
      });

      // Assert
      const userMessage = result.find((m) => m.role === "user");
      expect(userMessage?.content).toContain("Simplified Chinese");
    });

    it("繁体字中国語翻訳プロンプトを構築できること", () => {
      // Arrange / Act
      const result = buildPrompt({
        content: "Test content",
        title: "Title",
        targetLanguage: "zh-TW",
      });

      // Assert
      const userMessage = result.find((m) => m.role === "user");
      expect(userMessage?.content).toContain("Traditional Chinese");
    });

    it("韓国語翻訳プロンプトを構築できること", () => {
      // Arrange / Act
      const result = buildPrompt({
        content: "Test content",
        title: "Title",
        targetLanguage: "ko",
      });

      // Assert
      const userMessage = result.find((m) => m.role === "user");
      expect(userMessage?.content).toContain("Korean");
    });
  });

  describe("parseTranslationResponse", () => {
    it("JSON文字列から翻訳結果を解析できること", () => {
      // Arrange
      const response = '{"translatedTitle":"Test Title","translatedContent":"Test content"}';

      // Act
      const result = parseTranslationResponse(response);

      // Assert
      expect(result.translatedTitle).toBe("Test Title");
      expect(result.translatedContent).toBe("Test content");
    });

    it("JSONが壊れている場合エラーをスローすること", () => {
      // Arrange
      const response = "not json";

      // Act / Assert
      expect(() => parseTranslationResponse(response)).toThrow(
        "翻訳レスポンスの解析に失敗しました",
      );
    });

    it("必須フィールドがない場合エラーをスローすること", () => {
      // Arrange
      const response = '{"translatedTitle":"Title"}';

      // Act / Assert
      expect(() => parseTranslationResponse(response)).toThrow(
        "翻訳レスポンスの解析に失敗しました",
      );
    });

    it("コードブロックで囲まれたJSONを解析できること", () => {
      // Arrange
      const response = '```json\n{"translatedTitle":"Test","translatedContent":"Content"}\n```';

      // Act
      const result = parseTranslationResponse(response);

      // Assert
      expect(result.translatedTitle).toBe("Test");
    });
  });

  describe("translateArticle", () => {
    it("Workers AI で翻訳できること", async () => {
      // Arrange
      mockAi.run.mockResolvedValue({
        response:
          '{"translatedTitle":"How to use React Hooks","translatedContent":"# React Hooks\\n\\nTest body."}',
      });

      // Act
      const result = await translateArticle({
        ai: mockAi as unknown as Ai,
        content: "# React Hooks\n\nテスト本文です。",
        title: "React Hooksの使い方",
        targetLanguage: "en",
      });

      // Assert
      expect(result.translatedTitle).toBe("How to use React Hooks");
      expect(result.translatedContent).toContain("React Hooks");
      expect(result.model).toBe(DEFAULT_GEMMA_MODEL_TAG);
      expect(mockAi.run).toHaveBeenCalledOnce();
    });

    it("modelTagが指定されている場合は指定タグを返すこと", async () => {
      // Arrange
      mockAi.run.mockResolvedValue({
        response: '{"translatedTitle":"Title","translatedContent":"Content"}',
      });

      // Act
      const result = await translateArticle({
        ai: mockAi as unknown as Ai,
        content: "テスト",
        title: "テスト",
        targetLanguage: "en",
        modelTag: "custom-tag",
      });

      // Assert
      expect(result.model).toBe("custom-tag");
    });

    it("コードブロックを保持して翻訳できること", async () => {
      // Arrange
      const codeBlock = "```typescript\nconst x = 1;\n```";
      mockAi.run.mockResolvedValue({
        response: '{"translatedTitle":"Title","translatedContent":"Content\\n\\n{{CODE_BLOCK_0}}"}',
      });

      // Act
      const result = await translateArticle({
        ai: mockAi as unknown as Ai,
        content: `テスト\n\n${codeBlock}`,
        title: "タイトル",
        targetLanguage: "en",
      });

      // Assert
      expect(result.translatedContent).toContain("const x = 1");
    });

    it("Workers AI が失敗した場合エラーチェーンを持つエラーをスローすること", async () => {
      // Arrange
      const cause = new Error("Workers AI 接続エラー");
      mockAi.run.mockRejectedValue(cause);

      // Act / Assert
      const error = await translateArticle({
        ai: mockAi as unknown as Ai,
        content: "テスト",
        title: "タイトル",
        targetLanguage: "en",
      }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("翻訳の生成に失敗しました");
      expect((error as Error).cause).toBe(cause);
    });

    it("Workers AI が不正なレスポンスを返した場合エラーをスローすること", async () => {
      // Arrange
      mockAi.run.mockResolvedValue({ unexpected: "format" });

      // Act / Assert
      await expect(
        translateArticle({
          ai: mockAi as unknown as Ai,
          content: "テスト",
          title: "タイトル",
          targetLanguage: "en",
        }),
      ).rejects.toThrow("翻訳の生成に失敗しました");
    });

    it("HTMLコンテンツをサニタイズして送信すること", async () => {
      // Arrange
      mockAi.run.mockResolvedValue({
        response: '{"translatedTitle":"Title","translatedContent":"Content"}',
      });
      const htmlContent = "<h1>テスト</h1><script>alert('XSS')</script><p>本文</p>";

      // Act
      await translateArticle({
        ai: mockAi as unknown as Ai,
        content: htmlContent,
        title: "タイトル",
        targetLanguage: "en",
      });

      // Assert
      const callArgs = mockAi.run.mock.calls[0];
      const messages = callArgs[1].messages as Array<{ role: string; content: string }>;
      const userMessage = messages.find((m) => m.role === "user");
      expect(userMessage?.content).not.toContain("<script>");
      expect(userMessage?.content).not.toContain("<h1>");
    });
  });
});
