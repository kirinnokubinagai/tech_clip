jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(),
}));

import {
  clearAllOfflineData,
  getOfflineArticleById,
  getOfflineArticles,
  initLocalDb,
  upsertArticle,
  upsertSummary,
  upsertTranslation,
} from "@mobile/lib/localDb";
import { openDatabaseAsync } from "expo-sqlite";
import type { ArticleDetail, ArticleListItem } from "@/types/article";

/** モック型キャスト */
const mockOpenDatabaseAsync = openDatabaseAsync as jest.MockedFunction<typeof openDatabaseAsync>;

/** expo-sqlite DBモック */
const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockWithTransactionAsync = jest.fn();
const mockDb = {
  execAsync: mockExecAsync,
  runAsync: mockRunAsync,
  getAllAsync: mockGetAllAsync,
  getFirstAsync: mockGetFirstAsync,
  withTransactionAsync: mockWithTransactionAsync,
};

/** テスト用記事リストアイテム */
const mockArticleListItem: ArticleListItem = {
  id: "article-001",
  title: "テスト記事",
  author: "テスト著者",
  source: "zenn",
  publishedAt: "2024-01-01T00:00:00Z",
  excerpt: "テストの概要",
  thumbnailUrl: null,
  isFavorite: false,
  url: "https://zenn.dev/test/articles/001",
};

/** テスト用記事詳細 */
const mockArticleDetail: ArticleDetail = {
  id: "article-001",
  title: "テスト記事",
  author: "テスト著者",
  source: "zenn",
  publishedAt: "2024-01-01T00:00:00Z",
  content: "テストコンテンツ",
  excerpt: "テストの概要",
  thumbnailUrl: null,
  url: "https://zenn.dev/test/articles/001",
  isFavorite: false,
  isRead: false,
  summary: null,
  translation: null,
  readingTimeMinutes: 5,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("localDb", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecAsync.mockResolvedValue(undefined);
    mockRunAsync.mockResolvedValue(undefined);
    mockGetAllAsync.mockResolvedValue([]);
    mockGetFirstAsync.mockResolvedValue(null);
    mockWithTransactionAsync.mockImplementation(async (fn: () => Promise<void>) => {
      await fn();
    });
    // biome-ignore lint/suspicious/noExplicitAny: テスト用モック
    mockOpenDatabaseAsync.mockResolvedValue(mockDb as any);
    // DB シングルトンをリセットするためモジュールをリロード
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initLocalDb", () => {
    it("データベースを開いてテーブルを作成できること", async () => {
      // Act
      await initLocalDb();

      // Assert
      expect(mockOpenDatabaseAsync).toHaveBeenCalledWith("techclip.db");
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS articles"),
      );
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS summaries"),
      );
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS translations"),
      );
    });
  });

  describe("getOfflineArticles", () => {
    it("ローカルDBから記事一覧を取得できること", async () => {
      // Arrange
      const rawRow = {
        id: "article-001",
        title: "テスト記事",
        author: "テスト著者",
        source: "zenn",
        published_at: "2024-01-01T00:00:00Z",
        excerpt: "テストの概要",
        thumbnail_url: null,
        is_favorite: 0,
        url: "https://zenn.dev/test/articles/001",
      };
      mockGetAllAsync.mockResolvedValue([rawRow]);

      // Act
      await initLocalDb();
      const articles = await getOfflineArticles();

      // Assert
      expect(articles).toHaveLength(1);
      expect(articles[0]).toMatchObject({
        id: "article-001",
        title: "テスト記事",
        source: "zenn",
        isFavorite: false,
      });
    });

    it("記事が存在しない場合は空配列を返すこと", async () => {
      // Arrange
      mockGetAllAsync.mockResolvedValue([]);

      // Act
      await initLocalDb();
      const articles = await getOfflineArticles();

      // Assert
      expect(articles).toHaveLength(0);
    });
  });

  describe("getOfflineArticleById", () => {
    it("指定したIDの記事を取得できること", async () => {
      // Arrange
      const rawRow = {
        id: "article-001",
        title: "テスト記事",
        author: "テスト著者",
        source: "zenn",
        published_at: "2024-01-01T00:00:00Z",
        content: "テストコンテンツ",
        excerpt: "テストの概要",
        thumbnail_url: null,
        url: "https://zenn.dev/test/articles/001",
        is_favorite: 0,
        is_read: 0,
        summary: null,
        translation: null,
        reading_time_minutes: 5,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };
      mockGetFirstAsync.mockResolvedValue(rawRow);

      // Act
      await initLocalDb();
      const article = await getOfflineArticleById("article-001");

      // Assert
      expect(article).not.toBeNull();
      expect(article?.id).toBe("article-001");
      expect(article?.title).toBe("テスト記事");
      expect(article?.isFavorite).toBe(false);
      expect(article?.isRead).toBe(false);
    });

    it("存在しないIDの場合はnullを返すこと", async () => {
      // Arrange
      mockGetFirstAsync.mockResolvedValue(null);

      // Act
      await initLocalDb();
      const article = await getOfflineArticleById("nonexistent");

      // Assert
      expect(article).toBeNull();
    });
  });

  describe("upsertArticle", () => {
    it("記事一覧アイテムをローカルDBに保存できること", async () => {
      // Act
      await initLocalDb();
      await upsertArticle(mockArticleListItem);

      // Assert
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR REPLACE INTO articles"),
        expect.arrayContaining(["article-001", "テスト記事"]),
      );
    });

    it("記事詳細をローカルDBに保存できること", async () => {
      // Act
      await initLocalDb();
      await upsertArticle(mockArticleDetail);

      // Assert
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR REPLACE INTO articles"),
        expect.arrayContaining(["article-001", "テスト記事"]),
      );
    });
  });

  describe("upsertSummary", () => {
    it("記事の要約をローカルDBに保存できること", async () => {
      // Arrange
      const articleId = "article-001";
      const summary = "テスト要約テキスト";

      // Act
      await initLocalDb();
      await upsertSummary(articleId, summary);

      // Assert
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR REPLACE INTO summaries"),
        expect.arrayContaining([articleId, summary]),
      );
    });
  });

  describe("upsertTranslation", () => {
    it("記事の翻訳をローカルDBに保存できること", async () => {
      // Arrange
      const articleId = "article-001";
      const translation = "テスト翻訳テキスト";

      // Act
      await initLocalDb();
      await upsertTranslation(articleId, translation);

      // Assert
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining("INSERT OR REPLACE INTO translations"),
        expect.arrayContaining([articleId, translation]),
      );
    });
  });

  describe("clearAllOfflineData", () => {
    it("全オフラインデータをトランザクション内で削除できること", async () => {
      // Act
      await initLocalDb();
      await clearAllOfflineData();

      // Assert: トランザクションが使用されること
      expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);

      // Assert: 外部キー制約の順序で削除されること（translations → summaries → articles）
      const calls = mockRunAsync.mock.calls.map((call: unknown[]) => call[0] as string);
      const translationsIndex = calls.findIndex((sql) => sql.includes("DELETE FROM translations"));
      const summariesIndex = calls.findIndex((sql) => sql.includes("DELETE FROM summaries"));
      const articlesIndex = calls.findIndex((sql) => sql.includes("DELETE FROM articles"));

      expect(translationsIndex).toBeGreaterThanOrEqual(0);
      expect(summariesIndex).toBeGreaterThanOrEqual(0);
      expect(articlesIndex).toBeGreaterThanOrEqual(0);
      expect(translationsIndex).toBeLessThan(summariesIndex);
      expect(summariesIndex).toBeLessThan(articlesIndex);
    });
  });
});
