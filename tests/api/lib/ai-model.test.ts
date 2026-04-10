import { DEFAULT_GEMMA_MODEL_TAG, resolveGemmaModelTag } from "@api/lib/ai-model";
import { describe, expect, it } from "vitest";

describe("ai-model", () => {
  describe("DEFAULT_GEMMA_MODEL_TAG", () => {
    it("データベース保存用の短縮タグを定義していること", () => {
      // Arrange & Act
      const tag = DEFAULT_GEMMA_MODEL_TAG;

      // Assert
      expect(tag).toBe("gemma3-12b");
    });
  });

  describe("resolveGemmaModelTag", () => {
    it("環境変数が未定義の場合デフォルトタグを返すこと", () => {
      // Arrange
      const envValue = undefined;

      // Act
      const result = resolveGemmaModelTag(envValue);

      // Assert
      expect(result).toBe(DEFAULT_GEMMA_MODEL_TAG);
    });

    it("環境変数が空文字の場合デフォルトタグを返すこと", () => {
      // Arrange
      const envValue = "";

      // Act
      const result = resolveGemmaModelTag(envValue);

      // Assert
      expect(result).toBe(DEFAULT_GEMMA_MODEL_TAG);
    });

    it("環境変数が設定されている場合その値を返すこと", () => {
      // Arrange
      const envValue = "gemma4-9b";

      // Act
      const result = resolveGemmaModelTag(envValue);

      // Assert
      expect(result).toBe("gemma4-9b");
    });
  });
});
