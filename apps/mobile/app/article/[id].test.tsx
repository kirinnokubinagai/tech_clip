import { fireEvent, render, waitFor } from "@testing-library/react-native";

import ArticleDetailScreen from "./[id]";

/** 要約リクエストのmutate関数 */
const mockRequestSummaryMutate = jest.fn();

/** 翻訳リクエストのmutate関数 */
const mockRequestTranslationMutate = jest.fn();

/** 記事詳細データ */
const MOCK_ARTICLE = {
  id: "article-1",
  url: "https://zenn.dev/test/articles/test",
  title: "テスト記事",
  excerpt: "テスト説明",
  author: "テスト著者",
  source: "zenn" as const,
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  publishedAt: "2025-01-01T00:00:00.000Z",
  content: "# テスト内容\nサンプルコンテンツ",
  userId: "user-1",
  isRead: false,
  isFavorite: false,
  isPublic: false,
  summary: null,
  translation: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "article-1" }),
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("../../src/hooks/use-network-status", () => ({
  useNetworkStatus: jest.fn(() => ({ isOnline: true, isOffline: false })),
}));

jest.mock("../../src/lib/localDb", () => ({
  getOfflineArticleById: jest.fn(),
}));

jest.mock("../../src/hooks/use-articles", () => ({
  useArticleDetail: () => ({
    data: MOCK_ARTICLE,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useToggleFavorite: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useRequestSummary: () => ({
    mutate: mockRequestSummaryMutate,
    isPending: false,
    data: null,
  }),
  useRequestTranslation: () => ({
    mutate: mockRequestTranslationMutate,
    isPending: false,
    data: null,
  }),
  useSummaryJobStatus: () => ({
    mutate: jest.fn(),
  }),
  useTranslationJobStatus: () => ({
    mutate: jest.fn(),
  }),
}));

jest.mock("../../src/stores/settings-store", () => ({
  useSettingsStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      language: "日本語",
      isLanguageLoaded: true,
    }),
  ),
}));

jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  const { useSettingsStore } = require("../../src/stores/settings-store");
  (useSettingsStore as jest.Mock).mockImplementation(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({ language: "日本語", isLanguageLoaded: true }),
  );
  const { useNetworkStatus } = require("../../src/hooks/use-network-status");
  (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: true, isOffline: false });
});

describe("ArticleDetailScreen", () => {
  describe("オフラインフォールバック", () => {
    it("オフライン時にgetOfflineArticleByIdが呼ばれること", async () => {
      // Arrange
      const { useNetworkStatus } = require("../../src/hooks/use-network-status");
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });
      const { getOfflineArticleById } = require("../../src/lib/localDb");
      (getOfflineArticleById as jest.Mock).mockResolvedValue(MOCK_ARTICLE);

      // Act
      await render(<ArticleDetailScreen />);

      // Assert
      await waitFor(() => {
        expect(getOfflineArticleById).toHaveBeenCalledWith("article-1");
      });
    });

    it("オフライン時にローカルDBの記事が表示されること", async () => {
      // Arrange
      const { useNetworkStatus } = require("../../src/hooks/use-network-status");
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });
      const { getOfflineArticleById } = require("../../src/lib/localDb");
      (getOfflineArticleById as jest.Mock).mockResolvedValue(MOCK_ARTICLE);

      // Act
      const { getByText } = await render(<ArticleDetailScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("テスト記事")).toBeTruthy();
      });
    });

    it("オフライン時にローカルDBに記事がない場合はエラー表示になること", async () => {
      // Arrange
      const { useNetworkStatus } = require("../../src/hooks/use-network-status");
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });
      const { getOfflineArticleById } = require("../../src/lib/localDb");
      (getOfflineArticleById as jest.Mock).mockResolvedValue(null);

      // Act
      const { getByText } = await render(<ArticleDetailScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("記事の取得に失敗しました")).toBeTruthy();
      });
    });

    it("オンライン時はgetOfflineArticleByIdが呼ばれないこと", async () => {
      // Arrange
      const { getOfflineArticleById } = require("../../src/lib/localDb");

      // Act
      await render(<ArticleDetailScreen />);

      // Assert
      await waitFor(() => {
        expect(getOfflineArticleById).not.toHaveBeenCalled();
      });
    });
  });

  describe("要約ボタン", () => {
    it("要約ボタンを押すと言語設定の言語コードでrequestSummaryが呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<ArticleDetailScreen />);

      // Act
      await fireEvent.press(getByTestId("summary-button"));

      // Assert
      await waitFor(() => {
        expect(mockRequestSummaryMutate).toHaveBeenCalledWith({
          articleId: "article-1",
          language: "ja",
        });
      });
    });

    it("言語設定がEnglishの場合、要約リクエストに en が渡されること", async () => {
      // Arrange
      const { useSettingsStore } = require("../../src/stores/settings-store");
      (useSettingsStore as jest.Mock).mockImplementation(
        (selector: (state: Record<string, unknown>) => unknown) =>
          selector({ language: "English", isLanguageLoaded: true }),
      );
      const { getByTestId } = await render(<ArticleDetailScreen />);

      // Act
      await fireEvent.press(getByTestId("summary-button"));

      // Assert
      await waitFor(() => {
        expect(mockRequestSummaryMutate).toHaveBeenCalledWith({
          articleId: "article-1",
          language: "en",
        });
      });
    });
  });

  describe("翻訳ボタン", () => {
    it("翻訳ボタンを押すと言語設定の言語コードでrequestTranslationが呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<ArticleDetailScreen />);

      // Act
      await fireEvent.press(getByTestId("translation-button"));

      // Assert
      await waitFor(() => {
        expect(mockRequestTranslationMutate).toHaveBeenCalledWith({
          articleId: "article-1",
          targetLanguage: "ja",
        });
      });
    });

    it("言語設定がEnglishの場合、翻訳リクエストに en が渡されること", async () => {
      // Arrange
      const { useSettingsStore } = require("../../src/stores/settings-store");
      (useSettingsStore as jest.Mock).mockImplementation(
        (selector: (state: Record<string, unknown>) => unknown) =>
          selector({ language: "English", isLanguageLoaded: true }),
      );
      const { getByTestId } = await render(<ArticleDetailScreen />);

      // Act
      await fireEvent.press(getByTestId("translation-button"));

      // Assert
      await waitFor(() => {
        expect(mockRequestTranslationMutate).toHaveBeenCalledWith({
          articleId: "article-1",
          targetLanguage: "en",
        });
      });
    });
  });
});
