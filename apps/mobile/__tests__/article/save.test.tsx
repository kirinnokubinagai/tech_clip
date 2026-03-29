import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { containsText, findByTestId, queryByTestId } from "@/test-helpers";

import SaveScreen from "../../app/article/save";

/** apiFetchのモック */
const mockApiFetch = jest.fn();

jest.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock("@/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({ isAuthenticated: true, user: { id: "user-1" } }),
  ),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
}));

/** テスト用のプレビューレスポンス */
const MOCK_PREVIEW_RESPONSE = {
  success: true,
  data: {
    title: "React Nativeの新機能",
    excerpt: "React Native 0.76の新機能について解説します",
    author: "テスト著者",
    source: "zenn" as const,
    thumbnailUrl: null,
    readingTimeMinutes: 5,
    publishedAt: "2025-01-01T00:00:00.000Z",
  },
};

/** テスト用の保存成功レスポンス */
const MOCK_SAVE_RESPONSE = {
  success: true,
  data: {
    id: "article-1",
    url: "https://zenn.dev/test/articles/test-article",
    title: "React Nativeの新機能",
    excerpt: "React Native 0.76の新機能について解説します",
    author: "テスト著者",
    source: "zenn",
    thumbnailUrl: null,
    readingTimeMinutes: 5,
    publishedAt: "2025-01-01T00:00:00.000Z",
    content: null,
    userId: "user-1",
    isRead: false,
    isFavorite: false,
    isPublic: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
};

describe("SaveScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("初期表示", () => {
    it("URL入力フィールドが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<SaveScreen />);

      // Assert
      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      expect(input).toBeDefined();
    });

    it("取得ボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<SaveScreen />);

      // Assert
      expect(containsText(UNSAFE_root, "取得")).toBe(true);
    });

    it("プレビュー領域が初期状態では非表示であること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<SaveScreen />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "article-preview")).toBeNull();
    });

    it("保存ボタンが初期状態では非表示であること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<SaveScreen />);

      // Assert
      expect(containsText(UNSAFE_root, "保存する")).toBe(false);
    });
  });

  describe("URL取得フロー", () => {
    it("URLを入力して取得ボタンを押すとプレビューが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { UNSAFE_root } = render(<SaveScreen />);

      // Act
      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://zenn.dev/test/articles/test-article");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      // Assert
      await waitFor(() => {
        expect(findByTestId(UNSAFE_root, "article-preview")).toBeDefined();
        expect(containsText(UNSAFE_root, "React Nativeの新機能")).toBe(true);
      });
    });

    it("取得中はローディング状態が表示されること", async () => {
      // Arrange
      mockApiFetch.mockReturnValueOnce(new Promise(() => {}));
      const { UNSAFE_root } = render(<SaveScreen />);

      // Act
      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://zenn.dev/test");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      // Assert
      await waitFor(() => {
        expect(findByTestId(UNSAFE_root, "fetch-loading")).toBeDefined();
      });
    });

    it("空URLで取得ボタンを押すとエラーメッセージが表示されること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<SaveScreen />);

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "URLを入力してください")).toBe(true);
      });
    });

    it("不正なURLで取得ボタンを押すとエラーメッセージが表示されること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<SaveScreen />);

      // Act
      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "not-a-url");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "有効なURLを入力してください")).toBe(true);
      });
    });

    it("API取得失敗時にエラーメッセージが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "記事の取得に失敗しました" },
      });
      const { UNSAFE_root } = render(<SaveScreen />);

      // Act
      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://example.com/article");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "記事の取得に失敗しました")).toBe(true);
      });
    });
  });

  describe("プレビュー表示", () => {
    it("記事タイトルが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { UNSAFE_root } = render(<SaveScreen />);

      // Act
      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://zenn.dev/test/articles/test-article");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "React Nativeの新機能")).toBe(true);
      });
    });

    it("ソースバッジが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { UNSAFE_root } = render(<SaveScreen />);

      // Act
      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://zenn.dev/test/articles/test-article");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "zenn")).toBe(true);
      });
    });

    it("excerptが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { UNSAFE_root } = render(<SaveScreen />);

      // Act
      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://zenn.dev/test/articles/test-article");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "React Native 0.76の新機能について解説します")).toBe(true);
      });
    });

    it("保存ボタンが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { UNSAFE_root } = render(<SaveScreen />);

      // Act
      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://zenn.dev/test/articles/test-article");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "保存する")).toBe(true);
      });
    });
  });

  describe("保存フロー", () => {
    it("保存ボタンを押すとPOSTリクエストが送信されること", async () => {
      // Arrange
      mockApiFetch
        .mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE)
        .mockResolvedValueOnce(MOCK_SAVE_RESPONSE);
      const { UNSAFE_root } = render(<SaveScreen />);

      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://zenn.dev/test/articles/test-article");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      await waitFor(() => {
        expect(containsText(UNSAFE_root, "保存する")).toBe(true);
      });

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "save-button"));

      // Assert
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/articles",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ url: "https://zenn.dev/test/articles/test-article" }),
          }),
        );
      });
    });

    it("保存成功時に成功メッセージが表示されること", async () => {
      // Arrange
      mockApiFetch
        .mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE)
        .mockResolvedValueOnce(MOCK_SAVE_RESPONSE);
      const { UNSAFE_root } = render(<SaveScreen />);

      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://zenn.dev/test/articles/test-article");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      await waitFor(() => {
        expect(containsText(UNSAFE_root, "保存する")).toBe(true);
      });

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "save-button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "記事を保存しました")).toBe(true);
      });
    });

    it("保存失敗時にエラーメッセージが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE).mockResolvedValueOnce({
        success: false,
        error: { code: "DUPLICATE", message: "この記事はすでに保存されています" },
      });
      const { UNSAFE_root } = render(<SaveScreen />);

      const input = UNSAFE_root.findByProps({ placeholder: "https://" });
      fireEvent.changeText(input, "https://zenn.dev/test/articles/test-article");
      fireEvent.press(findByTestId(UNSAFE_root, "fetch-button"));

      await waitFor(() => {
        expect(containsText(UNSAFE_root, "保存する")).toBe(true);
      });

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "save-button"));

      // Assert
      await waitFor(() => {
        expect(containsText(UNSAFE_root, "この記事はすでに保存されています")).toBe(true);
      });
    });
  });
});
