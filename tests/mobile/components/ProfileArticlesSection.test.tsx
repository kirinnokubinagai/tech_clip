import { ProfileArticlesSection } from "@mobile/components/ProfileArticlesSection";
import { render, waitFor } from "@testing-library/react-native";

const mockFetchNextPage = jest.fn();
const mockUseInfiniteQuery = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => mockUseInfiniteQuery(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@mobile/lib/api", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@mobile/hooks/use-colors", () => ({
  useColors: () => ({ primary: "#14b8a6" }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "profile.savedArticles": "保存した記事",
        "profile.publicArticles": "公開記事",
        "profile.noSavedArticles": "まだ保存した記事がありません",
        "profile.noPublicArticles": "このユーザーの公開記事はまだありません",
        "profile.fetchError": "記事の取得に失敗しました",
      };
      return translations[key] ?? key;
    },
  }),
}));

jest.mock("@mobile/components/ArticleCard", () => ({
  ArticleCard: () => null,
}));

/** ローディング状態のデフォルトクエリ結果 */
const LOADING_QUERY = {
  data: undefined,
  isLoading: true,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: mockFetchNextPage,
};

/** 空状態のデフォルトクエリ結果 */
const EMPTY_QUERY = {
  data: { pages: [] },
  isLoading: false,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: mockFetchNextPage,
};

describe("ProfileArticlesSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseInfiniteQuery.mockReturnValue(EMPTY_QUERY);
  });

  describe("セクションタイトル", () => {
    it("saved モードのとき「保存した記事」が表示されること", async () => {
      // Arrange
      mockUseInfiniteQuery.mockReturnValue(EMPTY_QUERY);

      // Act
      const { getByText } = await render(<ProfileArticlesSection mode="saved" enabled={true} />);

      // Assert
      await waitFor(() => {
        expect(getByText("保存した記事")).not.toBeNull();
      });
    });

    it("public モードのとき「公開記事」が表示されること", async () => {
      // Arrange
      mockUseInfiniteQuery.mockReturnValue(EMPTY_QUERY);

      // Act
      const { getByText } = await render(
        <ProfileArticlesSection mode="public" userId="user-abc" />,
      );

      // Assert
      await waitFor(() => {
        expect(getByText("公開記事")).not.toBeNull();
      });
    });
  });

  describe("ローディング状態", () => {
    it("ローディング中はインジケータが表示されること", async () => {
      // Arrange
      mockUseInfiniteQuery.mockReturnValue(LOADING_QUERY);

      // Act
      const { queryByTestId } = await render(
        <ProfileArticlesSection mode="saved" enabled={true} />,
      );

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-articles-loading")).not.toBeNull();
      });
    });
  });

  describe("空状態", () => {
    it("saved モードで記事が0件のとき空メッセージが表示されること", async () => {
      // Arrange
      mockUseInfiniteQuery.mockReturnValue(EMPTY_QUERY);

      // Act
      const { queryByTestId } = await render(
        <ProfileArticlesSection mode="saved" enabled={true} />,
      );

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-articles-empty")).not.toBeNull();
      });
    });

    it("public モードで記事が0件のとき空メッセージが表示されること", async () => {
      // Arrange
      mockUseInfiniteQuery.mockReturnValue(EMPTY_QUERY);

      // Act
      const { queryByTestId } = await render(
        <ProfileArticlesSection mode="public" userId="user-abc" />,
      );

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-articles-empty")).not.toBeNull();
      });
    });
  });

  describe("エラー状態", () => {
    it("エラー時はエラー表示になること", async () => {
      // Arrange
      mockUseInfiniteQuery.mockReturnValue({
        ...EMPTY_QUERY,
        isError: true,
        data: undefined,
      });

      // Act
      const { queryByTestId } = await render(
        <ProfileArticlesSection mode="saved" enabled={true} />,
      );

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-articles-error")).not.toBeNull();
      });
    });
  });
});
