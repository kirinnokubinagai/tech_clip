/**
 * 検索画面テスト
 *
 * i18n キーを使用したテキスト・アクセシビリティラベルが正しく表示されることを確認する。
 */
import { useSearchArticles, useToggleFavorite } from "@mobile/hooks/use-articles";
import { useColors } from "@mobile/hooks/use-colors";
import SearchScreen from "@mobile-app/(tabs)/search";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { setMockLocale } from "../helpers/i18n-test-utils";

jest.mock("@mobile/hooks/use-articles", () => ({
  useSearchArticles: jest.fn(),
  useToggleFavorite: jest.fn(),
}));

jest.mock("@mobile/hooks/use-colors", () => ({
  useColors: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

jest.mock("@mobile/components/ArticleCard", () => ({
  ArticleCard: ({ article }: { article: { title: string } }) =>
    require("react").createElement(require("react-native").Text, null, article.title),
}));

/** useSearchArticles のデフォルトモック値 */
const DEFAULT_SEARCH_MOCK = {
  data: undefined,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
};

/** useColors のデフォルトモック値 */
const DEFAULT_COLORS_MOCK = {
  primary: "#14b8a6",
  border: "#e7e5e4",
  textDim: "#a8a29e",
  textMuted: "#78716c",
};

beforeEach(() => {
  jest.clearAllMocks();
  setMockLocale("ja");
  (useSearchArticles as jest.Mock).mockReturnValue(DEFAULT_SEARCH_MOCK);
  (useToggleFavorite as jest.Mock).mockReturnValue({ mutate: jest.fn() });
  (useColors as jest.Mock).mockReturnValue(DEFAULT_COLORS_MOCK);
});

describe("SearchScreen", () => {
  describe("初期表示（i18n）", () => {
    it("検索入力欄のプレースホルダーにi18nキーが使われること（日本語）", async () => {
      // Arrange & Act
      await render(<SearchScreen />);

      // Assert
      await waitFor(() => {
        expect(screen.getByPlaceholderText("記事を検索...")).toBeDefined();
      });
    });

    it("検索ヒントテキストにi18nキーが使われること（日本語）", async () => {
      // Arrange & Act
      await render(<SearchScreen />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText("キーワードで記事を検索")).toBeDefined();
      });
    });

    it("検索ヒントサブテキストにi18nキーが使われること（日本語）", async () => {
      // Arrange & Act
      await render(<SearchScreen />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText("タイトルや内容から検索できます。")).toBeDefined();
      });
    });
  });

  describe("クリアボタン（i18n）", () => {
    it("クリアボタンのアクセシビリティラベルにi18nキーが使われること（日本語）", async () => {
      // Arrange
      await render(<SearchScreen />);
      const input = screen.getByPlaceholderText("記事を検索...");

      // Act
      await fireEvent.changeText(input, "react");

      // Assert
      await waitFor(() => {
        expect(screen.getByLabelText("検索をクリア")).toBeDefined();
      });
    });
  });

  describe("ローディング状態（i18n）", () => {
    it("検索中テキストにi18nキーが使われること（日本語）", async () => {
      // Arrange
      (useSearchArticles as jest.Mock).mockReturnValue({
        ...DEFAULT_SEARCH_MOCK,
        isLoading: true,
      });
      await render(<SearchScreen />);
      const input = screen.getByPlaceholderText("記事を検索...");

      // Act
      await fireEvent.changeText(input, "react");

      // Assert
      await waitFor(
        () => {
          expect(screen.getByText("検索中...")).toBeDefined();
        },
        { timeout: 1500 },
      );
    });
  });

  describe("エラー状態（i18n）", () => {
    it("エラーテキストにi18nキーが使われること（日本語）", async () => {
      // Arrange
      (useSearchArticles as jest.Mock).mockReturnValue({
        ...DEFAULT_SEARCH_MOCK,
        isError: true,
        data: { pages: [{ items: [] }] },
      });

      await render(<SearchScreen />);
      const input = screen.getByPlaceholderText("記事を検索...");

      // Act
      await fireEvent.changeText(input, "react");

      // Assert
      await waitFor(
        () => {
          expect(screen.getByText("検索に失敗しました。")).toBeDefined();
        },
        { timeout: 1500 },
      );
    });

    it("エラー時の再試行ボタンにi18nキーが使われること（日本語）", async () => {
      // Arrange
      (useSearchArticles as jest.Mock).mockReturnValue({
        ...DEFAULT_SEARCH_MOCK,
        isError: true,
        data: { pages: [{ items: [] }] },
      });

      await render(<SearchScreen />);
      const input = screen.getByPlaceholderText("記事を検索...");

      // Act
      await fireEvent.changeText(input, "react");

      // Assert
      await waitFor(
        () => {
          expect(screen.getByText("再試行")).toBeDefined();
        },
        { timeout: 1500 },
      );
    });
  });

  describe("検索結果なし状態（i18n）", () => {
    it("クエリに一致する記事がない場合にnoMatchテキストがクエリ補間されて表示されること", async () => {
      // Arrange
      (useSearchArticles as jest.Mock).mockReturnValue({
        ...DEFAULT_SEARCH_MOCK,
        isError: false,
        data: { pages: [{ items: [] }] },
      });

      await render(<SearchScreen />);
      const input = screen.getByPlaceholderText("記事を検索...");

      // Act
      await fireEvent.changeText(input, "react");

      // Assert
      await waitFor(
        () => {
          expect(screen.getByText("「react」に一致する記事がありません。")).toBeDefined();
        },
        { timeout: 1500 },
      );
    });
  });

  describe("英語ロケール（i18n）", () => {
    beforeEach(() => {
      setMockLocale("en");
    });

    afterEach(() => {
      setMockLocale("ja");
    });

    it("検索入力欄のプレースホルダーが英語で表示されること", async () => {
      // Arrange & Act
      await render(<SearchScreen />);

      // Assert
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Search articles...")).toBeDefined();
      });
    });

    it("検索ヒントテキストが英語で表示されること", async () => {
      // Arrange & Act
      await render(<SearchScreen />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText("Search articles by keyword")).toBeDefined();
      });
    });

    it("クリアボタンのアクセシビリティラベルが英語で表示されること", async () => {
      // Arrange
      await render(<SearchScreen />);
      const input = screen.getByPlaceholderText("Search articles...");

      // Act
      await fireEvent.changeText(input, "react");

      // Assert
      await waitFor(() => {
        expect(screen.getByLabelText("Clear search")).toBeDefined();
      });
    });

    it("日本語ハードコードの「記事を検索...」が表示されないこと", async () => {
      // Arrange & Act
      await render(<SearchScreen />);

      // Assert
      await waitFor(() => {
        expect(screen.queryByPlaceholderText("記事を検索...")).toBeNull();
      });
    });
  });
});
