/**
 * ホーム画面 英語ロケールテスト
 *
 * en ロケール設定時に主要 UI 文言が英語で表示されることを確認する。
 */
import { useArticles, useToggleFavorite } from "@mobile/hooks/use-articles";
import { useNetworkStatus } from "@mobile/hooks/use-network-status";
import { useOfflineArticles } from "@mobile/hooks/use-offline-articles";
import HomeScreen from "@mobile-app/(tabs)/index";
import { render, waitFor } from "@testing-library/react-native";

/** en.json から実際の英語翻訳を解決するモック */
jest.mock("react-i18next", () => {
  const actualReact = jest.requireActual("react");
  const enTranslations = jest.requireActual("../../../apps/mobile/src/locales/en.json");

  function resolveKey(obj: Record<string, unknown>, key: string): string {
    const parts = key.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return key;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current !== undefined && current !== null ? String(current) : key;
  }

  function t(key: string, opts?: Record<string, unknown>): string {
    const value = resolveKey(enTranslations, key);
    if (opts && typeof value === "string") {
      return value.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) =>
        opts[k] !== undefined ? String(opts[k]) : `{{${k}}}`,
      );
    }
    return value;
  }

  const i18nStub = { language: "en", changeLanguage: jest.fn() };

  return {
    useTranslation: () => ({ t, i18n: i18nStub }),
    withTranslation: () => (Component: React.ComponentType) => {
      const Wrapped = (props: Record<string, unknown>) =>
        actualReact.createElement(Component, { ...props, t, i18n: i18nStub });
      Wrapped.displayName = `withTranslation(${(Component as { displayName?: string; name?: string }).displayName || (Component as { name?: string }).name || "Component"})`;
      return Wrapped;
    },
    initReactI18next: { type: "3rdParty", init: () => {} },
    Trans: ({ children }: { children: React.ReactNode }) => children,
    I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

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
  ArticleCard: ({ article }: { article: { title: string } }) =>
    require("react").createElement(require("react-native").Text, null, article.title),
}));

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

describe("HomeScreen（英語ロケール）", () => {
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

  describe("フィルターUI", () => {
    it("ソースフィルターの「全て」ラベルが英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<HomeScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("All")).toBeTruthy();
      });
    });

    it("お気に入りフィルターが英語で表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<HomeScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("Favorites")).toBeTruthy();
      });
    });
  });

  describe("ローディング状態", () => {
    it("読み込み中に英語のローディング文言が表示されること", async () => {
      // Arrange
      (useArticles as jest.Mock).mockReturnValue({
        ...DEFAULT_USE_ARTICLES_MOCK,
        isLoading: true,
      });

      // Act
      const { getByText } = await render(<HomeScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("Loading...")).toBeTruthy();
      });
    });
  });

  describe("エラー状態", () => {
    it("エラー時に英語のエラーメッセージが表示されること", async () => {
      // Arrange
      (useArticles as jest.Mock).mockReturnValue({
        ...DEFAULT_USE_ARTICLES_MOCK,
        isError: true,
        data: undefined,
      });

      // Act
      const { getByText } = await render(<HomeScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("Failed to fetch articles")).toBeTruthy();
      });
    });

    it("エラー時に英語の再試行ボタンが表示されること", async () => {
      // Arrange
      (useArticles as jest.Mock).mockReturnValue({
        ...DEFAULT_USE_ARTICLES_MOCK,
        isError: true,
        data: undefined,
      });

      // Act
      const { getByText } = await render(<HomeScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("Retry")).toBeTruthy();
      });
    });
  });

  describe("オフライン状態", () => {
    it("オフライン時にキャッシュなしメッセージが英語で表示されること", async () => {
      // Arrange
      (useNetworkStatus as jest.Mock).mockReturnValue({
        isOnline: false,
        isOffline: true,
      });
      (useOfflineArticles as jest.Mock).mockReturnValue({
        articles: [],
        isLoading: false,
      });

      // Act
      const { getByText } = await render(<HomeScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("Offline: No cache available")).toBeTruthy();
      });
    });
  });

  describe("日本語ハードコードの不在確認", () => {
    it("ローディング中に日本語「読み込み中」が表示されないこと", async () => {
      // Arrange
      (useArticles as jest.Mock).mockReturnValue({
        ...DEFAULT_USE_ARTICLES_MOCK,
        isLoading: true,
      });

      // Act
      const { queryByText } = await render(<HomeScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByText("読み込み中...")).toBeNull();
      });
    });

    it("エラー時に日本語「記事の取得に失敗しました」が表示されないこと", async () => {
      // Arrange
      (useArticles as jest.Mock).mockReturnValue({
        ...DEFAULT_USE_ARTICLES_MOCK,
        isError: true,
        data: undefined,
      });

      // Act
      const { queryByText } = await render(<HomeScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByText("記事の取得に失敗しました")).toBeNull();
      });
    });
  });
});
