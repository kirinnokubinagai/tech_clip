import { useNetworkStatus } from "@mobile/hooks/use-network-status";
import { useOfflineArticles } from "@mobile/hooks/use-offline-articles";
import { getOfflineArticles } from "@mobile/lib/localDb";
import { act, renderHook, waitFor } from "@testing-library/react-native";

jest.mock("@mobile/lib/localDb", () => ({
  getOfflineArticles: jest.fn(),
}));

jest.mock("@mobile/hooks/use-network-status", () => ({
  useNetworkStatus: jest.fn(),
}));

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

  it("オフラインのとき localDb から記事を取得できること", async () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOnline: false,
      isOffline: true,
    });
    (getOfflineArticles as jest.Mock).mockResolvedValue(MOCK_ARTICLES);

    const { result } = await renderHook(() => useOfflineArticles());

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.articles).toEqual(MOCK_ARTICLES);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("オフラインのとき getOfflineArticles が呼ばれること", async () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOnline: false,
      isOffline: true,
    });
    (getOfflineArticles as jest.Mock).mockResolvedValue([]);

    await renderHook(() => useOfflineArticles());

    await waitFor(() => {
      expect(getOfflineArticles).toHaveBeenCalledTimes(1);
    });
  });

  it("localDb 取得エラー時に articles が空配列になること", async () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOnline: false,
      isOffline: true,
    });
    (getOfflineArticles as jest.Mock).mockRejectedValue(new Error("ローカルDB取得に失敗しました"));

    const { result } = await renderHook(() => useOfflineArticles());

    await waitFor(() => {
      expect(result.current.articles).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("オンラインのとき articles が空配列であること", async () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    const { result } = await renderHook(() => useOfflineArticles());

    expect(result.current.articles).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("オンラインのとき getOfflineArticles が呼ばれないこと", async () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOnline: true,
      isOffline: false,
    });

    await renderHook(() => useOfflineArticles());

    await waitFor(() => {
      expect(getOfflineArticles).not.toHaveBeenCalled();
    });
  });

  it("オフライン取得開始直後は isLoading が true であること", async () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOnline: false,
      isOffline: true,
    });

    let resolveArticles!: (articles: typeof MOCK_ARTICLES) => void;
    const pendingPromise = new Promise<typeof MOCK_ARTICLES>((resolve) => {
      resolveArticles = resolve;
    });
    (getOfflineArticles as jest.Mock).mockReturnValue(pendingPromise);

    const { result } = await renderHook(() => useOfflineArticles());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveArticles(MOCK_ARTICLES);
      await Promise.resolve();
    });
  });
});
