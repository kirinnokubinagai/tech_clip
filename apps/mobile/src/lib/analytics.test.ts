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
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true }),
});
(globalThis as Record<string, unknown>).fetch = mockFetch;

describe("analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  describe("trackEvent", () => {
    it("イベントをAPIに送信すること", async () => {
      // Act
      await trackEvent(AnalyticsEventName.ARTICLE_VIEW, { articleId: "article-123" });

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("エラーをスローせずに正常に完了すること", async () => {
      // Act & Assert
      await expect(trackEvent(AnalyticsEventName.ARTICLE_VIEW, {})).resolves.toBeUndefined();
    });

    it("fetch失敗時もエラーをスローしないこと", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("ネットワークエラー"));

      // Act & Assert
      await expect(
        trackEvent(AnalyticsEventName.ARTICLE_VIEW, { articleId: "article-123" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("trackScreenView", () => {
    it("画面表示イベントを送信すること", async () => {
      // Act
      await trackScreenView("ArticleDetail");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("trackArticleView", () => {
    it("記事閲覧イベントを送信すること", async () => {
      // Act
      await trackArticleView("article-456");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("trackArticleSave", () => {
    it("記事保存イベントを送信すること", async () => {
      // Act
      await trackArticleSave("article-789");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("trackArticleShare", () => {
    it("記事シェアイベントを送信すること", async () => {
      // Act
      await trackArticleShare("article-101");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("trackAiSummaryRequest", () => {
    it("AI要約リクエストイベントを送信すること", async () => {
      // Act
      await trackAiSummaryRequest("article-202");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("trackSearch", () => {
    it("検索イベントを送信すること", async () => {
      // Act
      await trackSearch("typescript hooks");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
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
