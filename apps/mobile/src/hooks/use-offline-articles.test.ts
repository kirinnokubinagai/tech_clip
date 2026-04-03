import { act, renderHook } from "@testing-library/react-native";

jest.mock("@/lib/localDb", () => ({
  getOfflineArticles: jest.fn(),
}));

jest.mock("@/hooks/use-network-status", () => ({
  useNetworkStatus: jest.fn(),
}));

import { getOfflineArticles } from "../lib/localDb";
import { useNetworkStatus } from "./use-network-status";
import { useOfflineArticles } from "./use-offline-articles";

/** テスト用記事データ */
const MOCK_ARTICLES = [
  {
    id: "article-1",
    title: "テスト記事1",
    author: "著者1",
    source: "zenn" as const,
    publishedAt: "2024-01-01T00:00:00Z",
    excerpt: "記事の抜粋1",
    thumbnailUrl: null,
    isFavorite: false,
    url: "https://zenn.dev/test/1",
  },
  {
    id: "article-2",
    title: "テスト記事2",
    author: "著者2",
    source: "qiita" as const,
    publishedAt: "2024-01-02T00:00:00Z",
    excerpt: "記事の抜粋2",
    thumbnailUrl: null,
    isFavorite: true,
    url: "https://qiita.com/test/2",
  },
];

describe("useOfflineArticles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("オフライン時", () => {
    it("オフラインのときlocalDbから記事を取得できること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });
      (getOfflineArticles as jest.Mock).mockResolvedValue(MOCK_ARTICLES);

      // Act
      const { result } = await renderHook(() => useOfflineArticles());

      await act(async () => {
        await Promise.resolve();
      });

      // Assert
      expect(result.current.articles).toEqual(MOCK_ARTICLES);
      expect(result.current.isLoading).toBe(false);
    });

    it("オフラインのときgetOfflineArticlesが呼ばれること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });
      (getOfflineArticles as jest.Mock).mockResolvedValue([]);

      // Act
      await renderHook(() => useOfflineArticles());
      await act(async () => {
        await Promise.resolve();
      });

      // Assert
      expect(getOfflineArticles).toHaveBeenCalledTimes(1);
    });

    it("localDb取得エラー時にarticlesが空配列になること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });
      (getOfflineArticles as jest.Mock).mockRejectedValue(
        new Error("ローカルDB取得に失敗しました"),
      );

      // Act
      const { result } = await renderHook(() => useOfflineArticles());
      await act(async () => {
        await Promise.resolve();
      });

      // Assert
      expect(result.current.articles).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("オンライン時", () => {
    it("オンラインのときarticlesが空配列であること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: true,
        isOffline: false,
      });

      // Act
      const { result } = await renderHook(() => useOfflineArticles());

      // Assert
      expect(result.current.articles).toEqual([]);
    });

    it("オンラインのときgetOfflineArticlesが呼ばれないこと", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: true,
        isOffline: false,
      });

      // Act
      await renderHook(() => useOfflineArticles());
      await act(async () => {
        await Promise.resolve();
      });

      // Assert
      expect(getOfflineArticles).not.toHaveBeenCalled();
    });

    it("オンラインのときisLoadingがfalseであること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: true,
        isOffline: false,
      });

      // Act
      const { result } = await renderHook(() => useOfflineArticles());

      // Assert
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("初期状態", () => {
    it("オフライン時の取得開始直後はisLoadingがtrueであること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      let resolveArticles!: (articles: typeof MOCK_ARTICLES) => void;
      const pendingPromise = new Promise<typeof MOCK_ARTICLES>((resolve) => {
        resolveArticles = resolve;
      });
      (getOfflineArticles as jest.Mock).mockReturnValue(pendingPromise);

      // Act - レンダリング直後（非同期完了前）
      const { result } = await renderHook(() => useOfflineArticles());

      // Assert - 取得中はisLoadingがtrue
      expect(result.current.isLoading).toBe(true);

      // Cleanup - Promiseを解決してリソースをクリーンアップ
      await act(async () => {
        resolveArticles(MOCK_ARTICLES);
        await Promise.resolve();
      });
    });
  });
});
