jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock("@mobile/lib/localDb", () => ({
  initLocalDb: jest.fn().mockResolvedValue(undefined),
  upsertArticle: jest.fn().mockResolvedValue(undefined),
  upsertSummary: jest.fn().mockResolvedValue(undefined),
  upsertTranslation: jest.fn().mockResolvedValue(undefined),
  getOfflineArticles: jest.fn().mockResolvedValue([]),
  getOfflineTargetArticleIds: jest.fn().mockResolvedValue([]),
}));

jest.mock("@mobile/lib/api", () => ({
  apiFetch: jest.fn(),
}));

import { apiFetch } from "@mobile/lib/api";
import {
  getOfflineTargetArticleIds,
  initLocalDb,
  upsertArticle,
  upsertSummary,
  upsertTranslation,
} from "@mobile/lib/localDb";
import {
  prefetchOfflineArticleContents,
  syncAllForOffline,
  syncArticleDetail,
  syncArticles,
} from "@mobile/lib/syncManager";

import type { ArticleDetail, ArticleListItem } from "@/types/article";

/** モック型キャスト */
const mockApiFetch = jest.mocked(apiFetch);
const mockInitLocalDb = jest.mocked(initLocalDb);
const mockUpsertArticle = jest.mocked(upsertArticle);
const mockUpsertSummary = jest.mocked(upsertSummary);
const mockUpsertTranslation = jest.mocked(upsertTranslation);
const mockGetOfflineTargetArticleIds = jest.mocked(getOfflineTargetArticleIds);

/** apiFetch の戻り値を unknown 経由でキャストするヘルパー */
function asApiFetchResult<T>(value: T): Awaited<ReturnType<typeof apiFetch>> {
  return value as unknown as Awaited<ReturnType<typeof apiFetch>>;
}

/** テスト用記事一覧レスポンス */
const mockArticleListResponse = {
  success: true,
  data: [
    {
      id: "article-001",
      title: "テスト記事1",
      author: "著者1",
      source: "zenn",
      publishedAt: "2024-01-01T00:00:00Z",
      excerpt: "概要1",
      thumbnailUrl: null,
      isFavorite: false,
      url: "https://zenn.dev/test/1",
    } as ArticleListItem,
    {
      id: "article-002",
      title: "テスト記事2",
      author: "著者2",
      source: "qiita",
      publishedAt: "2024-01-02T00:00:00Z",
      excerpt: "概要2",
      thumbnailUrl: null,
      isFavorite: true,
      url: "https://qiita.com/test/2",
    } as ArticleListItem,
  ],
  meta: { nextCursor: null, hasNext: false },
};

/** テスト用記事詳細レスポンス */
const mockArticleDetailData: ArticleDetail = {
  id: "article-001",
  title: "テスト記事1",
  author: "著者1",
  source: "zenn",
  publishedAt: "2024-01-01T00:00:00Z",
  content: "詳細コンテンツ",
  excerpt: "概要1",
  thumbnailUrl: null,
  url: "https://zenn.dev/test/1",
  isFavorite: false,
  isRead: false,
  summary: "AI要約テキスト",
  translation: "翻訳テキスト",
  readingTimeMinutes: 5,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("syncManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitLocalDb.mockResolvedValue(undefined);
    mockUpsertArticle.mockResolvedValue(undefined);
    mockUpsertSummary.mockResolvedValue(undefined);
    mockUpsertTranslation.mockResolvedValue(undefined);
    mockGetOfflineTargetArticleIds.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("syncArticles", () => {
    it("サーバーから記事一覧を取得してローカルDBに保存できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(asApiFetchResult(mockArticleListResponse));

      // Act
      const result = await syncArticles();

      // Assert
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/articles"),
        expect.any(Object),
      );
      expect(mockUpsertArticle).toHaveBeenCalledTimes(2);
      expect(mockUpsertArticle).toHaveBeenCalledWith(
        expect.objectContaining({ id: "article-001" }),
      );
      expect(mockUpsertArticle).toHaveBeenCalledWith(
        expect.objectContaining({ id: "article-002" }),
      );
      expect(result.synced).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it("APIがエラーを返した場合はsyncedが0でerrorが含まれること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(
        asApiFetchResult({
          success: false,
          error: { code: "AUTH_REQUIRED", message: "ログインが必要です。" },
        }),
      );

      // Act
      const result = await syncArticles();

      // Assert
      expect(mockUpsertArticle).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it("ネットワークエラーが発生した場合はsyncedが0でerrorが含まれること", async () => {
      // Arrange
      mockApiFetch.mockRejectedValue(new Error("ネットワークエラー"));

      // Act
      const result = await syncArticles();

      // Assert
      expect(mockUpsertArticle).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it("記事が0件の場合はsyncedが0でerrorが空であること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(
        asApiFetchResult({
          success: true,
          data: [],
          meta: { nextCursor: null, hasNext: false },
        }),
      );

      // Act
      const result = await syncArticles();

      // Assert
      expect(mockUpsertArticle).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("複数ページある場合は全ページの記事を同期できること", async () => {
      // Arrange
      const page1Article = {
        id: "article-page1",
        title: "ページ1記事",
        author: "著者",
        source: "zenn",
        publishedAt: "2024-01-01T00:00:00Z",
        excerpt: "概要",
        thumbnailUrl: null,
        isFavorite: false,
        url: "https://zenn.dev/test/page1",
      } as ArticleListItem;
      const page2Article = {
        id: "article-page2",
        title: "ページ2記事",
        author: "著者",
        source: "qiita",
        publishedAt: "2024-01-02T00:00:00Z",
        excerpt: "概要",
        thumbnailUrl: null,
        isFavorite: false,
        url: "https://qiita.com/test/page2",
      } as ArticleListItem;

      mockApiFetch
        .mockResolvedValueOnce(
          asApiFetchResult({
            success: true,
            data: [page1Article],
            meta: { nextCursor: "cursor-abc", hasNext: true },
          }),
        )
        .mockResolvedValueOnce(
          asApiFetchResult({
            success: true,
            data: [page2Article],
            meta: { nextCursor: null, hasNext: false },
          }),
        );

      // Act
      const result = await syncArticles();

      // Assert
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
      expect(mockApiFetch).toHaveBeenNthCalledWith(1, "/api/articles", expect.any(Object));
      expect(mockApiFetch).toHaveBeenNthCalledWith(
        2,
        "/api/articles?cursor=cursor-abc",
        expect.any(Object),
      );
      expect(mockUpsertArticle).toHaveBeenCalledTimes(2);
      expect(result.synced).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("syncArticleDetail", () => {
    it("記事詳細をサーバーから取得してローカルDBに保存できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(
        asApiFetchResult({ success: true, data: mockArticleDetailData }),
      );

      // Act
      const result = await syncArticleDetail("article-001");

      // Assert
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/articles/article-001?language=ja&targetLanguage=en",
        expect.any(Object),
      );
      expect(mockUpsertArticle).toHaveBeenCalledWith(
        expect.objectContaining({ id: "article-001" }),
      );
      expect(mockUpsertSummary).toHaveBeenCalledWith("article-001", "ja", "AI要約テキスト");
      expect(mockUpsertTranslation).toHaveBeenCalledWith("article-001", "en", "翻訳テキスト");
      expect(result.success).toBe(true);
    });

    it("summaryがnullの場合はupsertSummaryを呼ばないこと", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(
        asApiFetchResult({
          success: true,
          data: { ...mockArticleDetailData, summary: null },
        }),
      );

      // Act
      const result = await syncArticleDetail("article-001");

      // Assert
      expect(mockUpsertSummary).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("translationがnullの場合はupsertTranslationを呼ばないこと", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(
        asApiFetchResult({
          success: true,
          data: { ...mockArticleDetailData, translation: null },
        }),
      );

      // Act
      const result = await syncArticleDetail("article-001");

      // Assert
      expect(mockUpsertTranslation).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("APIがエラーを返した場合はsuccessがfalseであること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(
        asApiFetchResult({
          success: false,
          error: { code: "NOT_FOUND", message: "記事が見つかりません" },
        }),
      );

      // Act
      const result = await syncArticleDetail("article-001");

      // Assert
      expect(mockUpsertArticle).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("記事が見つかりません");
      }
    });

    it("ネットワークエラーが発生した場合はsuccessがfalseであること", async () => {
      // Arrange
      mockApiFetch.mockRejectedValue(new Error("接続エラー"));

      // Act
      const result = await syncArticleDetail("article-001");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("prefetchOfflineArticleContents", () => {
    it("対象記事の詳細を順次取得してローカルDBに保存できること", async () => {
      // Arrange
      mockGetOfflineTargetArticleIds.mockResolvedValue(["article-001", "article-002"]);
      mockApiFetch
        .mockResolvedValueOnce(
          asApiFetchResult({
            success: true,
            data: { ...mockArticleDetailData, id: "article-001" },
          }),
        )
        .mockResolvedValueOnce(
          asApiFetchResult({
            success: true,
            data: { ...mockArticleDetailData, id: "article-002" },
          }),
        );

      // Act
      const result = await prefetchOfflineArticleContents(20);

      // Assert
      expect(mockUpsertArticle).toHaveBeenCalledTimes(2);
      expect(result.prefetched).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it("個別記事の取得失敗時は errors に記録して処理を継続すること", async () => {
      // Arrange
      mockGetOfflineTargetArticleIds.mockResolvedValue(["article-001", "article-002"]);
      mockApiFetch
        .mockResolvedValueOnce(
          asApiFetchResult({
            success: false,
            error: { code: "NOT_FOUND", message: "記事が見つかりません" },
          }),
        )
        .mockResolvedValueOnce(
          asApiFetchResult({
            success: true,
            data: { ...mockArticleDetailData, id: "article-002" },
          }),
        );

      // Act
      const result = await prefetchOfflineArticleContents(20);

      // Assert
      expect(result.errors).toHaveLength(1);
      expect(result.prefetched).toBe(1);
    });

    it("対象 ID が空の場合はプレフェッチをスキップすること", async () => {
      // Arrange
      mockGetOfflineTargetArticleIds.mockResolvedValue([]);

      // Act
      const result = await prefetchOfflineArticleContents(20);

      // Assert
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(result.prefetched).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("個別記事の取得で例外が発生した場合は errors に記録して処理を継続すること", async () => {
      // Arrange
      mockGetOfflineTargetArticleIds.mockResolvedValue(["article-001", "article-002"]);
      mockApiFetch.mockRejectedValueOnce(new Error("ネットワークエラー")).mockResolvedValueOnce(
        asApiFetchResult({
          success: true,
          data: { ...mockArticleDetailData, id: "article-002" },
        }),
      );

      // Act
      const result = await prefetchOfflineArticleContents(20);

      // Assert
      expect(result.errors).toHaveLength(1);
      expect(result.prefetched).toBe(1);
    });
  });

  describe("syncAllForOffline", () => {
    it("一覧同期後に本文プレフェッチを呼び出すこと", async () => {
      // Arrange
      mockApiFetch
        .mockResolvedValueOnce(asApiFetchResult(mockArticleListResponse))
        .mockResolvedValueOnce(asApiFetchResult({ success: true, data: mockArticleDetailData }));
      mockGetOfflineTargetArticleIds.mockResolvedValue(["article-001"]);

      // Act
      const result = await syncAllForOffline();

      // Assert
      expect(result.listSynced).toBe(2);
      expect(result.contentsPrefetched).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it("一覧同期失敗時でも本文プレフェッチを実行すること", async () => {
      // Arrange
      mockApiFetch
        .mockResolvedValueOnce(
          asApiFetchResult({
            success: false,
            error: { code: "INTERNAL_ERROR", message: "サーバーエラー" },
          }),
        )
        .mockResolvedValueOnce(asApiFetchResult({ success: true, data: mockArticleDetailData }));
      mockGetOfflineTargetArticleIds.mockResolvedValue(["article-001"]);

      // Act
      const result = await syncAllForOffline();

      // Assert
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.contentsPrefetched).toBe(1);
    });
  });
});
