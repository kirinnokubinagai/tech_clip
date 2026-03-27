import { renderHook, waitFor } from "@testing-library/react-native";

import { SEARCH_QUERY_KEY_PREFIX, searchArticles } from "../use-search-articles";

/** テスト用の記事データ */
const MOCK_ARTICLE = {
  id: "article_001",
  userId: "user_01",
  url: "https://example.com/article-1",
  source: "zenn",
  title: "React Hooksの基礎",
  author: "テスト著者",
  excerpt: "React Hooksについての記事です",
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  isRead: false,
  isFavorite: false,
  isPublic: false,
  publishedAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("searchArticles", () => {
  describe("クエリキー", () => {
    it("クエリキープレフィックスが定義されていること", () => {
      // Assert
      expect(SEARCH_QUERY_KEY_PREFIX).toBe("search-articles");
    });
  });

  describe("API呼び出し", () => {
    it("searchArticlesが関数として定義されていること", () => {
      // Assert
      expect(typeof searchArticles).toBe("function");
    });
  });
});
