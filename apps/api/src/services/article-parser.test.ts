import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArticleSource } from "@tech-clip/types";

import { parseArticle } from "./article-parser";
import * as sourceDetectorModule from "./source-detector";

vi.mock("./source-detector", () => ({
  detectSource: vi.fn(),
}));

vi.mock("./parsers/generic", () => ({
  parseGeneric: vi.fn(),
}));

/** モック化されたdetectSource */
const mockDetectSource = sourceDetectorModule.detectSource as Mock;

/** テスト用のパース結果 */
const MOCK_PARSE_RESULT = {
  title: "テスト記事",
  content: "<p>テスト本文</p>",
  excerpt: "テスト本文",
  author: "テストユーザー",
  thumbnailUrl: "https://example.com/thumb.jpg",
  publishedAt: "2024-01-01T00:00:00Z",
};

describe("parseArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ソース判定とルーティング", () => {
    it("Zenn URLが正しくルーティングされること", async () => {
      // Arrange
      const url = "https://zenn.dev/user/articles/example";
      mockDetectSource.mockReturnValue("zenn");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(sourceDetectorModule.detectSource).toHaveBeenCalledWith(url);
      expect(result.source).toBe("zenn");
      expect(result.title).toBe("テスト記事");
    });

    it("Qiita URLが正しくルーティングされること", async () => {
      // Arrange
      const url = "https://qiita.com/user/items/abc123";
      mockDetectSource.mockReturnValue("qiita");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(sourceDetectorModule.detectSource).toHaveBeenCalledWith(url);
      expect(result.source).toBe("qiita");
    });

    it("note URLが正しくルーティングされること", async () => {
      // Arrange
      const url = "https://note.com/user/n/nxxxxxxx";
      mockDetectSource.mockReturnValue("note");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result.source).toBe("note");
    });

    it("はてなブログ URLが正しくルーティングされること", async () => {
      // Arrange
      const url = "https://example.hatenablog.com/entry/2024/01/01/title";
      mockDetectSource.mockReturnValue("hatena");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result.source).toBe("hatena");
    });

    it("Dev.to URLが正しくルーティングされること", async () => {
      // Arrange
      const url = "https://dev.to/user/article-title";
      mockDetectSource.mockReturnValue("devto");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result.source).toBe("devto");
    });

    it("Medium URLが正しくルーティングされること", async () => {
      // Arrange
      const url = "https://medium.com/@user/article-title-abc123";
      mockDetectSource.mockReturnValue("medium");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result.source).toBe("medium");
    });

    it("GitHub URLが正しくルーティングされること", async () => {
      // Arrange
      const url = "https://github.com/user/repo";
      mockDetectSource.mockReturnValue("github");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result.source).toBe("github");
    });

    it("Stack Overflow URLが正しくルーティングされること", async () => {
      // Arrange
      const url = "https://stackoverflow.com/questions/12345/title";
      mockDetectSource.mockReturnValue("stackoverflow");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result.source).toBe("stackoverflow");
    });
  });

  describe("汎用パーサーへのフォールバック", () => {
    it("未知のURLがgenericパーサーで処理されること", async () => {
      // Arrange
      const url = "https://example.com/article";
      mockDetectSource.mockReturnValue("other");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(parseGeneric).toHaveBeenCalledWith(url);
      expect(result.source).toBe("other");
      expect(result.title).toBe("テスト記事");
    });

    it("既知ソースも現時点ではgenericパーサーにフォールバックすること", async () => {
      // Arrange
      const url = "https://zenn.dev/user/articles/example";
      mockDetectSource.mockReturnValue("zenn");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      await parseArticle(url);

      // Assert
      expect(parseGeneric).toHaveBeenCalledWith(url);
    });
  });

  describe("パース結果の構造", () => {
    it("sourceフィールドがdetectSourceの結果で上書きされること", async () => {
      // Arrange
      const url = "https://zenn.dev/user/articles/example";
      mockDetectSource.mockReturnValue("zenn");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue({
        ...MOCK_PARSE_RESULT,
        source: "other",
      });

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result.source).toBe("zenn");
    });

    it("パース結果のフィールドが保持されること", async () => {
      // Arrange
      const url = "https://example.com/article";
      mockDetectSource.mockReturnValue("other");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockResolvedValue(MOCK_PARSE_RESULT);

      // Act
      const result = await parseArticle(url);

      // Assert
      expect(result).toMatchObject({
        title: "テスト記事",
        content: "<p>テスト本文</p>",
        excerpt: "テスト本文",
        author: "テストユーザー",
        thumbnailUrl: "https://example.com/thumb.jpg",
        publishedAt: "2024-01-01T00:00:00Z",
        source: "other",
      });
    });
  });

  describe("エラーハンドリング", () => {
    it("パーサーがエラーを投げた場合そのまま伝播すること", async () => {
      // Arrange
      const url = "https://example.com/article";
      mockDetectSource.mockReturnValue("other");
      const { parseGeneric } = await import("./parsers/generic");
      (parseGeneric as Mock).mockRejectedValue(new Error("記事の取得に失敗しました"));

      // Act & Assert
      await expect(parseArticle(url)).rejects.toThrow("記事の取得に失敗しました");
    });
  });
});
