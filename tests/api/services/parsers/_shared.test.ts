import { describe, expect, it } from "vitest";
import {
  calculateReadingTime,
  createExcerpt,
  EXCERPT_MAX_LENGTH,
  MIN_READING_TIME_MINUTES,
  READING_SPEED_CHARS_PER_MIN,
  TECHCLIP_USER_AGENT,
} from "../../../../apps/api/src/services/parsers/_shared";

describe("_shared", () => {
  describe("定数", () => {
    it("TECHCLIP_USER_AGENTがTechClipBotを含むこと", () => {
      // Arrange（なし）
      // Assert
      expect(TECHCLIP_USER_AGENT).toContain("TechClipBot");
    });

    it("READING_SPEED_CHARS_PER_MINが500であること", () => {
      // Arrange（なし）
      // Assert
      expect(READING_SPEED_CHARS_PER_MIN).toBe(500);
    });

    it("MIN_READING_TIME_MINUTESが1であること", () => {
      // Arrange（なし）
      // Assert
      expect(MIN_READING_TIME_MINUTES).toBe(1);
    });

    it("EXCERPT_MAX_LENGTHが200であること", () => {
      // Arrange（なし）
      // Assert
      expect(EXCERPT_MAX_LENGTH).toBe(200);
    });
  });

  describe("calculateReadingTime", () => {
    it("500文字のテキストで1分を返すこと", () => {
      // Arrange
      const text = "あ".repeat(500);

      // Act
      const result = calculateReadingTime(text);

      // Assert
      expect(result).toBe(1);
    });

    it("1000文字のテキストで2分を返すこと", () => {
      // Arrange
      const text = "あ".repeat(1000);

      // Act
      const result = calculateReadingTime(text);

      // Assert
      expect(result).toBe(2);
    });

    it("空文字の場合に最小値1分を返すこと", () => {
      // Arrange
      const text = "";

      // Act
      const result = calculateReadingTime(text);

      // Assert
      expect(result).toBe(1);
    });

    it("1文字の場合に最小値1分を返すこと", () => {
      // Arrange
      const text = "a";

      // Act
      const result = calculateReadingTime(text);

      // Assert
      expect(result).toBe(1);
    });

    it("501文字のテキストで2分を返すこと（切り上げ）", () => {
      // Arrange
      const text = "a".repeat(501);

      // Act
      const result = calculateReadingTime(text);

      // Assert
      expect(result).toBe(2);
    });
  });

  describe("createExcerpt", () => {
    it("200文字以下のテキストをそのまま返すこと", () => {
      // Arrange
      const text = "あ".repeat(200);

      // Act
      const result = createExcerpt(text);

      // Assert
      expect(result).toBe(text);
    });

    it("201文字のテキストを200文字+...に切り詰めること", () => {
      // Arrange
      const text = "あ".repeat(201);

      // Act
      const result = createExcerpt(text);

      // Assert
      expect(result).toBe(`${"あ".repeat(200)}...`);
    });

    it("空文字をそのまま返すこと", () => {
      // Arrange
      const text = "";

      // Act
      const result = createExcerpt(text);

      // Assert
      expect(result).toBe("");
    });

    it("最大文字数より1文字少ないテキストをそのまま返すこと", () => {
      // Arrange
      const text = "a".repeat(EXCERPT_MAX_LENGTH - 1);

      // Act
      const result = createExcerpt(text);

      // Assert
      expect(result).toBe(text);
    });

    it("ちょうど最大文字数のテキストをそのまま返すこと", () => {
      // Arrange
      const text = "a".repeat(EXCERPT_MAX_LENGTH);

      // Act
      const result = createExcerpt(text);

      // Assert
      expect(result).toHaveLength(EXCERPT_MAX_LENGTH);
      expect(result).toBe(text);
    });

    it("最大文字数+1文字のテキストを切り詰めて...を付与すること", () => {
      // Arrange
      const text = "a".repeat(EXCERPT_MAX_LENGTH + 1);

      // Act
      const result = createExcerpt(text);

      // Assert
      expect(result).toBe(`${"a".repeat(EXCERPT_MAX_LENGTH)}...`);
    });
  });
});
