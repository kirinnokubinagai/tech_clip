import ArticleDetailScreen from "@mobile-app/article/[id]";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const { __setMockLocale } = require("react-i18next") as {
  __setMockLocale: (locale: "ja" | "en") => void;
};

/** 要約リクエストのmutate関数 */
const mockRequestSummaryMutate = jest.fn();

/** 翻訳リクエストのmutate関数 */
const mockRequestTranslationMutate = jest.fn();

/** useArticleDetail のモック戻り値（テストで切り替え可能にする） */
const mockArticleDetailState: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
} = {
  data: undefined,
  isLoading: false,
  isError: false,
};

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

jest.mock("@mobile/hooks/use-network-status", () => ({
  useNetworkStatus: jest.fn(() => ({ isOnline: true, isOffline: false })),
}));

jest.mock("@mobile/lib/localDb", () => ({
  getOfflineArticleById: jest.fn(),
}));

jest.mock("@mobile/hooks/use-articles", () => ({
  useArticleDetail: () => ({
    data: mockArticleDetailState.data,
    isLoading: mockArticleDetailState.isLoading,
    isError: mockArticleDetailState.isError,
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

jest.mock("@mobile/stores/settings-store", () => ({
  useSettingsStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      language: "ja",
      isLanguageLoaded: true,
    }),
  ),
}));

jest.mock("react-native/Libraries/Linking/Linking", () => ({
  openURL: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  __setMockLocale("ja");
  mockArticleDetailState.data = MOCK_ARTICLE;
  mockArticleDetailState.isLoading = false;
  mockArticleDetailState.isError = false;
  const { useSettingsStore } = require("@mobile/stores/settings-store");
  (useSettingsStore as jest.Mock).mockImplementation(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({ language: "ja", isLanguageLoaded: true }),
  );
  const { useNetworkStatus } = require("@mobile/hooks/use-network-status");
  (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: true, isOffline: false });
});

describe("ArticleDetailScreen", () => {
  describe("オフラインフォールバック", () => {
    it("オフライン時にgetOfflineArticleByIdが呼ばれること", async () => {
      // Arrange
      const { useNetworkStatus } = require("@mobile/hooks/use-network-status");
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });
      const { getOfflineArticleById } = require("@mobile/lib/localDb");
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
      const { useNetworkStatus } = require("@mobile/hooks/use-network-status");
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });
      const { getOfflineArticleById } = require("@mobile/lib/localDb");
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
      const { useNetworkStatus } = require("@mobile/hooks/use-network-status");
      (useNetworkStatus as jest.Mock).mockReturnValue({ isOnline: false, isOffline: true });
      const { getOfflineArticleById } = require("@mobile/lib/localDb");
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
      const { getOfflineArticleById } = require("@mobile/lib/localDb");

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
      const { useSettingsStore } = require("@mobile/stores/settings-store");
      (useSettingsStore as jest.Mock).mockImplementation(
        (selector: (state: Record<string, unknown>) => unknown) =>
          selector({ language: "en", isLanguageLoaded: true }),
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
      const { useSettingsStore } = require("@mobile/stores/settings-store");
      (useSettingsStore as jest.Mock).mockImplementation(
        (selector: (state: Record<string, unknown>) => unknown) =>
          selector({ language: "en", isLanguageLoaded: true }),
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

  describe("多言語対応", () => {
    it("日本語ロケールで読了時間と要約/翻訳ラベルが日本語で表示されること", async () => {
      // Arrange
      __setMockLocale("ja");

      // Act
      const { getByText } = await render(<ArticleDetailScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("5分で読めます")).toBeTruthy();
        expect(getByText("要約")).toBeTruthy();
        expect(getByText("翻訳")).toBeTruthy();
      });
    });

    it("英語ロケールで読了時間と要約/翻訳ラベルが英語で表示されること", async () => {
      // Arrange
      __setMockLocale("en");

      // Act
      const { getByText } = await render(<ArticleDetailScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("5 min read")).toBeTruthy();
        expect(getByText("Summarize")).toBeTruthy();
        expect(getByText("Translate")).toBeTruthy();
      });
    });

    it("英語ロケールでエラー表示時に英語の fetchError とリトライ文言が表示されること", async () => {
      // Arrange
      __setMockLocale("en");
      mockArticleDetailState.data = undefined;
      mockArticleDetailState.isError = true;

      // Act
      const { getByText } = await render(<ArticleDetailScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("Failed to fetch article")).toBeTruthy();
        expect(getByText("Retry")).toBeTruthy();
        expect(getByText("Back")).toBeTruthy();
      });
    });
  });
});
