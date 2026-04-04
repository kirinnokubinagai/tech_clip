import { GenerateSummarySchema, GenerateTranslationSchema } from "@api/validators/ai";
import { describe, expect, it } from "vitest";

describe("GenerateTranslationSchema", () => {
  describe("正常系", () => {
    it("targetLanguage=enでバリデーションが通ること", () => {
      // Arrange
      const input = { targetLanguage: "en" };

      // Act
      const result = GenerateTranslationSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.targetLanguage).toBe("en");
    });

    it("targetLanguage=jaでバリデーションが通ること", () => {
      // Arrange
      const input = { targetLanguage: "ja" };

      // Act
      const result = GenerateTranslationSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.targetLanguage).toBe("ja");
    });
  });

  describe("異常系", () => {
    it("サポートされていない言語コードでエラーになること", () => {
      // Arrange
      const input = { targetLanguage: "fr" };

      // Act
      const result = GenerateTranslationSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("en");
    });

    it("targetLanguageが未指定の場合エラーになること", () => {
      // Arrange
      const input = {};

      // Act
      const result = GenerateTranslationSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("targetLanguageが空文字の場合エラーになること", () => {
      // Arrange
      const input = { targetLanguage: "" };

      // Act
      const result = GenerateTranslationSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("GenerateSummarySchema", () => {
  describe("正常系", () => {
    it("languageを指定しない場合デフォルト値でバリデーションが通ること", () => {
      // Arrange
      const input = {};

      // Act
      const result = GenerateSummarySchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("language=jaを指定してバリデーションが通ること", () => {
      // Arrange
      const input = { language: "ja" };

      // Act
      const result = GenerateSummarySchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.language).toBe("ja");
    });

    it("language=enを指定してバリデーションが通ること", () => {
      // Arrange
      const input = { language: "en" };

      // Act
      const result = GenerateSummarySchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.language).toBe("en");
    });
  });

  describe("異常系", () => {
    it("サポートされていない言語コードでエラーになること", () => {
      // Arrange
      const input = { language: "zh" };

      // Act
      const result = GenerateSummarySchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});
