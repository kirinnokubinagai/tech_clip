import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

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
    thumbnailUrl: "https://example.com/thumb.png",
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
    thumbnailUrl: "https://example.com/thumb.png",
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
      render(<SaveScreen />);

      // Assert
      expect(screen.getByPlaceholderText("https://")).toBeTruthy();
    });

    it("取得ボタンが表示されること", () => {
      // Arrange & Act
      render(<SaveScreen />);

      // Assert
      expect(screen.getByText("取得")).toBeTruthy();
    });

    it("プレビュー領域が初期状態では非表示であること", () => {
      // Arrange & Act
      render(<SaveScreen />);

      // Assert
      expect(screen.queryByTestId("article-preview")).toBeNull();
    });

    it("保存ボタンが初期状態では非表示であること", () => {
      // Arrange & Act
      render(<SaveScreen />);

      // Assert
      expect(screen.queryByText("保存する")).toBeNull();
    });
  });

  describe("URL取得フロー", () => {
    it("URLを入力して取得ボタンを押すとプレビューが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      render(<SaveScreen />);

      // Act
      fireEvent.changeText(
        screen.getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      fireEvent.press(screen.getByText("取得"));

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId("article-preview")).toBeTruthy();
        expect(screen.getByText("React Nativeの新機能")).toBeTruthy();
      });
    });

    it("取得中はローディング状態が表示されること", async () => {
      // Arrange
      mockApiFetch.mockReturnValueOnce(new Promise(() => {}));
      render(<SaveScreen />);

      // Act
      fireEvent.changeText(screen.getByPlaceholderText("https://"), "https://zenn.dev/test");
      fireEvent.press(screen.getByText("取得"));

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId("fetch-loading")).toBeTruthy();
      });
    });

    it("空URLで取得ボタンを押すとエラーメッセージが表示されること", async () => {
      // Arrange
      render(<SaveScreen />);

      // Act
      fireEvent.press(screen.getByText("取得"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("URLを入力してください")).toBeTruthy();
      });
    });

    it("不正なURLで取得ボタンを押すとエラーメッセージが表示されること", async () => {
      // Arrange
      render(<SaveScreen />);

      // Act
      fireEvent.changeText(screen.getByPlaceholderText("https://"), "not-a-url");
      fireEvent.press(screen.getByText("取得"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("有効なURLを入力してください")).toBeTruthy();
      });
    });

    it("API取得失敗時にエラーメッセージが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "記事の取得に失敗しました" },
      });
      render(<SaveScreen />);

      // Act
      fireEvent.changeText(screen.getByPlaceholderText("https://"), "https://example.com/article");
      fireEvent.press(screen.getByText("取得"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("記事の取得に失敗しました")).toBeTruthy();
      });
    });
  });

  describe("プレビュー表示", () => {
    it("記事タイトルが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      render(<SaveScreen />);

      // Act
      fireEvent.changeText(
        screen.getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      fireEvent.press(screen.getByText("取得"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("React Nativeの新機能")).toBeTruthy();
      });
    });

    it("ソースバッジが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      render(<SaveScreen />);

      // Act
      fireEvent.changeText(
        screen.getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      fireEvent.press(screen.getByText("取得"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("zenn")).toBeTruthy();
      });
    });

    it("excerptが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      render(<SaveScreen />);

      // Act
      fireEvent.changeText(
        screen.getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      fireEvent.press(screen.getByText("取得"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("React Native 0.76の新機能について解説します")).toBeTruthy();
      });
    });

    it("保存ボタンが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      render(<SaveScreen />);

      // Act
      fireEvent.changeText(
        screen.getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      fireEvent.press(screen.getByText("取得"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("保存する")).toBeTruthy();
      });
    });
  });

  describe("保存フロー", () => {
    it("保存ボタンを押すとPOSTリクエストが送信されること", async () => {
      // Arrange
      mockApiFetch
        .mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE)
        .mockResolvedValueOnce(MOCK_SAVE_RESPONSE);
      render(<SaveScreen />);

      fireEvent.changeText(
        screen.getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      fireEvent.press(screen.getByText("取得"));

      await waitFor(() => {
        expect(screen.getByText("保存する")).toBeTruthy();
      });

      // Act
      fireEvent.press(screen.getByText("保存する"));

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
      render(<SaveScreen />);

      fireEvent.changeText(
        screen.getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      fireEvent.press(screen.getByText("取得"));

      await waitFor(() => {
        expect(screen.getByText("保存する")).toBeTruthy();
      });

      // Act
      fireEvent.press(screen.getByText("保存する"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("記事を保存しました")).toBeTruthy();
      });
    });

    it("保存失敗時にエラーメッセージが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE).mockResolvedValueOnce({
        success: false,
        error: { code: "DUPLICATE", message: "この記事はすでに保存されています" },
      });
      render(<SaveScreen />);

      fireEvent.changeText(
        screen.getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      fireEvent.press(screen.getByText("取得"));

      await waitFor(() => {
        expect(screen.getByText("保存する")).toBeTruthy();
      });

      // Act
      fireEvent.press(screen.getByText("保存する"));

      // Assert
      await waitFor(() => {
        expect(screen.getByText("この記事はすでに保存されています")).toBeTruthy();
      });
    });
  });
});
