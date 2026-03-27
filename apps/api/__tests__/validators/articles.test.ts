import { describe, expect, it } from "vitest";
import {
  CreateArticleSchema,
  SearchArticlesSchema,
  UpdateArticleSchema,
} from "../../src/validators/articles";

describe("CreateArticleSchema", () => {
  describe("正常系", () => {
    it("有効なhttps URLでバリデーションが通ること", () => {
      // Arrange
      const input = { url: "https://example.com/article" };

      // Act
      const result = CreateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("有効なhttp URLでバリデーションが通ること", () => {
      // Arrange
      const input = { url: "http://example.com/article" };

      // Act
      const result = CreateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });

    it("クエリパラメータ付きURLでバリデーションが通ること", () => {
      // Arrange
      const input = { url: "https://example.com/article?id=123&ref=top" };

      // Act
      const result = CreateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("urlが空文字の場合エラーになること", () => {
      // Arrange
      const input = { url: "" };

      // Act
      const result = CreateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("urlがURL形式でない場合エラーになること", () => {
      // Arrange
      const input = { url: "not-a-url" };

      // Act
      const result = CreateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("URL");
    });

    it("urlがftp://の場合エラーになること", () => {
      // Arrange
      const input = { url: "ftp://example.com/file" };

      // Act
      const result = CreateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("https://");
    });

    it("urlが2048文字を超える場合エラーになること", () => {
      // Arrange
      const longPath = "a".repeat(2040);
      const input = { url: `https://example.com/${longPath}` };

      // Act
      const result = CreateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("2048");
    });

    it("urlが未指定の場合エラーになること", () => {
      // Arrange
      const input = {};

      // Act
      const result = CreateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("UpdateArticleSchema", () => {
  describe("正常系", () => {
    it("isReadのみ指定でバリデーションが通ること", () => {
      // Arrange
      const input = { isRead: true };

      // Act
      const result = UpdateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.isRead).toBe(true);
    });

    it("isFavoriteのみ指定でバリデーションが通ること", () => {
      // Arrange
      const input = { isFavorite: false };

      // Act
      const result = UpdateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.isFavorite).toBe(false);
    });

    it("isPublicのみ指定でバリデーションが通ること", () => {
      // Arrange
      const input = { isPublic: true };

      // Act
      const result = UpdateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.isPublic).toBe(true);
    });

    it("複数フィールド指定でバリデーションが通ること", () => {
      // Arrange
      const input = { isRead: true, isFavorite: false, isPublic: true };

      // Act
      const result = UpdateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("フィールドが何も指定されない場合エラーになること", () => {
      // Arrange
      const input = {};

      // Act
      const result = UpdateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("1つ以上");
    });

    it("isReadに文字列を渡した場合エラーになること", () => {
      // Arrange
      const input = { isRead: "true" };

      // Act
      const result = UpdateArticleSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("SearchArticlesSchema", () => {
  describe("正常系", () => {
    it("有効な検索キーワードでバリデーションが通ること", () => {
      // Arrange
      const input = { q: "TypeScript" };

      // Act
      const result = SearchArticlesSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.q).toBe("TypeScript");
    });

    it("limitを指定してバリデーションが通ること", () => {
      // Arrange
      const input = { q: "React", limit: 10 };

      // Act
      const result = SearchArticlesSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(10);
    });

    it("limitを省略した場合デフォルト値20になること", () => {
      // Arrange
      const input = { q: "Next.js" };

      // Act
      const result = SearchArticlesSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
    });
  });

  describe("異常系", () => {
    it("qが空文字の場合エラーになること", () => {
      // Arrange
      const input = { q: "" };

      // Act
      const result = SearchArticlesSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("qが200文字を超える場合エラーになること", () => {
      // Arrange
      const input = { q: "a".repeat(201) };

      // Act
      const result = SearchArticlesSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain("200");
    });

    it("limitが0の場合エラーになること", () => {
      // Arrange
      const input = { q: "test", limit: 0 };

      // Act
      const result = SearchArticlesSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("limitが51の場合エラーになること", () => {
      // Arrange
      const input = { q: "test", limit: 51 };

      // Act
      const result = SearchArticlesSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});
