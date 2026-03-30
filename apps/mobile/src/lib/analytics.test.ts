jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { apiUrl: "http://test-api.example.com" },
    },
  },
}));

import {
  AnalyticsEventName,
  trackAiSummaryRequest,
  trackArticleSave,
  trackArticleShare,
  trackArticleView,
  trackEvent,
  trackScreenView,
  trackSearch,
} from "./analytics";

/** fetchモック */
const mockFetch = jest.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

describe("analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("trackEvent", () => {
    it("バックエンド未実装のためfetchを呼び出さないこと", async () => {
      // Act
      await trackEvent(AnalyticsEventName.ARTICLE_VIEW, { articleId: "article-123" });

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("エラーをスローせずに正常に完了すること", async () => {
      // Act & Assert
      await expect(trackEvent(AnalyticsEventName.ARTICLE_VIEW, {})).resolves.toBeUndefined();
    });
  });

  describe("trackScreenView", () => {
    it("fetchを呼び出さずに正常に完了すること", async () => {
      // Act
      await trackScreenView("ArticleDetail");

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("trackArticleView", () => {
    it("fetchを呼び出さずに正常に完了すること", async () => {
      // Act
      await trackArticleView("article-456");

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("trackArticleSave", () => {
    it("fetchを呼び出さずに正常に完了すること", async () => {
      // Act
      await trackArticleSave("article-789");

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("trackArticleShare", () => {
    it("fetchを呼び出さずに正常に完了すること", async () => {
      // Act
      await trackArticleShare("article-101");

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("trackAiSummaryRequest", () => {
    it("fetchを呼び出さずに正常に完了すること", async () => {
      // Act
      await trackAiSummaryRequest("article-202");

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("trackSearch", () => {
    it("fetchを呼び出さずに正常に完了すること", async () => {
      // Act
      await trackSearch("typescript hooks");

      // Assert
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("AnalyticsEventName", () => {
    it("必要なイベント名の定数がすべて定義されていること", () => {
      // Assert
      expect(AnalyticsEventName.SCREEN_VIEW).toBe("screen_view");
      expect(AnalyticsEventName.ARTICLE_VIEW).toBe("article_view");
      expect(AnalyticsEventName.ARTICLE_SAVE).toBe("article_save");
      expect(AnalyticsEventName.ARTICLE_SHARE).toBe("article_share");
      expect(AnalyticsEventName.AI_SUMMARY_REQUEST).toBe("ai_summary_request");
      expect(AnalyticsEventName.SEARCH).toBe("search");
    });
  });
});
