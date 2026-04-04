import { useArticles, useToggleFavorite } from "@mobile/hooks/use-articles";
import { useNetworkStatus } from "@mobile/hooks/use-network-status";
import { useOfflineArticles } from "@mobile/hooks/use-offline-articles";
import HomeScreen from "@mobile-app/(tabs)/index";
import { render, waitFor } from "@testing-library/react-native";

jest.mock("@mobile/hooks/use-articles", () => ({
  useArticles: jest.fn(),
  useToggleFavorite: jest.fn(),
}));

jest.mock("@mobile/hooks/use-network-status", () => ({
  useNetworkStatus: jest.fn(),
}));

jest.mock("@mobile/hooks/use-offline-articles", () => ({
  useOfflineArticles: jest.fn(),
}));

jest.mock("@mobile/components/ArticleCard", () => ({
  ArticleCard: ({ article }: { article: { title: string } }) => {
    const { Text } = require("react-native");
    return <Text>{article.title}</Text>;
  },
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
];

/** useArticles のデフォルトモック値 */
const DEFAULT_USE_ARTICLES_MOCK = {
  data: undefined,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
  isRefetching: false,
};

/** useToggleFavorite のデフォルトモック値 */
const DEFAULT_USE_TOGGLE_FAVORITE_MOCK = {
  mutate: jest.fn(),
};

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useArticles as jest.Mock).mockReturnValue(DEFAULT_USE_ARTICLES_MOCK);
    (useToggleFavorite as jest.Mock).mockReturnValue(DEFAULT_USE_TOGGLE_FAVORITE_MOCK);
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOnline: true,
      isOffline: false,
    });
    (useOfflineArticles as jest.Mock).mockReturnValue({
      articles: [],
      isLoading: false,
    });
  });

  it("オンライン時に取得した記事一覧を表示できること", async () => {
    (useArticles as jest.Mock).mockReturnValue({
      ...DEFAULT_USE_ARTICLES_MOCK,
      data: { pages: [{ items: MOCK_ARTICLES, nextCursor: null, hasNext: false }] },
    });

    const { getByText } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText("テスト記事1")).toBeTruthy();
    });
  });

  it("オフライン時に offlineArticles が使われること", async () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOnline: false,
      isOffline: true,
    });
    (useOfflineArticles as jest.Mock).mockReturnValue({
      articles: MOCK_ARTICLES,
      isLoading: false,
    });

    const { getByText } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(useOfflineArticles).toHaveBeenCalledTimes(1);
      expect(getByText("テスト記事1")).toBeTruthy();
    });
  });

  it("オフライン時でキャッシュがない場合に空メッセージが表示されること", async () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOnline: false,
      isOffline: true,
    });
    (useOfflineArticles as jest.Mock).mockReturnValue({
      articles: [],
      isLoading: false,
    });

    const { getByText } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText("オフライン：キャッシュがありません")).toBeTruthy();
    });
  });

  it("読み込み中にローディング文言が表示されること", async () => {
    (useArticles as jest.Mock).mockReturnValue({
      ...DEFAULT_USE_ARTICLES_MOCK,
      isLoading: true,
    });

    const { getByText } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText("読み込み中...")).toBeTruthy();
    });
  });

  it("エラー時に再試行UIが表示されること", async () => {
    (useArticles as jest.Mock).mockReturnValue({
      ...DEFAULT_USE_ARTICLES_MOCK,
      isError: true,
      data: undefined,
    });

    const { getByText } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText("記事の取得に失敗しました")).toBeTruthy();
      expect(getByText("再試行")).toBeTruthy();
    });
  });

  it("未実装の詳細フィルター導線が表示されないこと", async () => {
    const { queryByLabelText } = await render(<HomeScreen />);

    await waitFor(() => {
      expect(queryByLabelText("フィルター")).toBeNull();
    });
  });
});
