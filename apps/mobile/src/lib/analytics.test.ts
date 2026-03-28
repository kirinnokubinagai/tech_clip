jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { apiUrl: "http://test-api.example.com" },
    },
  },
}));

jest.mock("./secure-store", () => ({
  getAuthToken: jest.fn().mockResolvedValue(null),
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setAuthToken: jest.fn().mockResolvedValue(undefined),
  clearAuthTokens: jest.fn().mockResolvedValue(undefined),
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
global.fetch = mockFetch;

/**
 * fetchレスポンスのモックヘルパー
 */
function createFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue(createFetchResponse({ success: true, data: null }));
  });

  describe("trackEvent", () => {
    it("イベント名とプロパティをAPIに送信できること", async () => {
      // Arrange
      const eventName = AnalyticsEventName.ARTICLE_VIEW;
      const properties = { articleId: "article-123", source: "zenn" };

      // Act
      await trackEvent(eventName, properties);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "http://test-api.example.com/analytics/events",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.event).toBe(eventName);
      expect(callBody.properties).toEqual(properties);
    });

    it("APIが失敗してもエラーをスローせずに静かに失敗すること", async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error("ネットワークエラー"));

      // Act & Assert（エラーがスローされないこと）
      await expect(trackEvent(AnalyticsEventName.ARTICLE_VIEW, {})).resolves.toBeUndefined();
    });

    it("APIが500を返してもエラーをスローせずに静かに失敗すること", async () => {
      // Arrange
      mockFetch.mockResolvedValue(
        createFetchResponse({ success: false, error: { code: "INTERNAL_ERROR" } }, 500),
      );

      // Act & Assert
      await expect(
        trackEvent(AnalyticsEventName.SCREEN_VIEW, { screen: "Home" }),
      ).resolves.toBeUndefined();
    });

    it("送信データにtimestampが含まれること", async () => {
      // Arrange
      const before = Date.now();

      // Act
      await trackEvent(AnalyticsEventName.SEARCH, { query: "react" });

      // Assert
      const after = Date.now();
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.timestamp).toBeGreaterThanOrEqual(before);
      expect(callBody.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("trackScreenView", () => {
    it("画面名をプロパティとしてSCREEN_VIEWイベントを送信できること", async () => {
      // Arrange
      const screenName = "ArticleDetail";

      // Act
      await trackScreenView(screenName);

      // Assert
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.event).toBe(AnalyticsEventName.SCREEN_VIEW);
      expect(callBody.properties.screen).toBe(screenName);
    });
  });

  describe("trackArticleView", () => {
    it("記事IDをプロパティとしてARTICLE_VIEWイベントを送信できること", async () => {
      // Arrange
      const articleId = "article-456";

      // Act
      await trackArticleView(articleId);

      // Assert
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.event).toBe(AnalyticsEventName.ARTICLE_VIEW);
      expect(callBody.properties.articleId).toBe(articleId);
    });
  });

  describe("trackArticleSave", () => {
    it("記事IDをプロパティとしてARTICLE_SAVEイベントを送信できること", async () => {
      // Arrange
      const articleId = "article-789";

      // Act
      await trackArticleSave(articleId);

      // Assert
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.event).toBe(AnalyticsEventName.ARTICLE_SAVE);
      expect(callBody.properties.articleId).toBe(articleId);
    });
  });

  describe("trackArticleShare", () => {
    it("記事IDをプロパティとしてARTICLE_SHAREイベントを送信できること", async () => {
      // Arrange
      const articleId = "article-101";

      // Act
      await trackArticleShare(articleId);

      // Assert
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.event).toBe(AnalyticsEventName.ARTICLE_SHARE);
      expect(callBody.properties.articleId).toBe(articleId);
    });
  });

  describe("trackAiSummaryRequest", () => {
    it("記事IDをプロパティとしてAI_SUMMARY_REQUESTイベントを送信できること", async () => {
      // Arrange
      const articleId = "article-202";

      // Act
      await trackAiSummaryRequest(articleId);

      // Assert
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.event).toBe(AnalyticsEventName.AI_SUMMARY_REQUEST);
      expect(callBody.properties.articleId).toBe(articleId);
    });
  });

  describe("trackSearch", () => {
    it("検索クエリをプロパティとしてSEARCHイベントを送信できること", async () => {
      // Arrange
      const query = "typescript hooks";

      // Act
      await trackSearch(query);

      // Assert
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.event).toBe(AnalyticsEventName.SEARCH);
      expect(callBody.properties.query).toBe(query);
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
