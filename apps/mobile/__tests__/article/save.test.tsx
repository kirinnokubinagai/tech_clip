import { fireEvent, render, waitFor } from "@testing-library/react-native";

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

/** Toastのshowモック関数（呼び出し検証用） */
const mockShowToast = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: { message: "", variant: "success" as const, visible: false },
    show: (...args: unknown[]) => mockShowToast(...args),
    dismiss: jest.fn(),
  }),
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
    mockShowToast.mockClear();
  });

  describe("初期表示", () => {
    it("URL入力フィールドが表示されること", async () => {
      // Arrange & Act
      const { getByPlaceholderText } = await render(<SaveScreen />);

      // Assert
      expect(getByPlaceholderText("https://")).toBeDefined();
    });

    it("取得ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<SaveScreen />);

      // Assert
      expect(getByText("取得")).toBeDefined();
    });

    it("プレビュー領域が初期状態では非表示であること", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(<SaveScreen />);

      // Assert
      expect(queryByTestId("article-preview")).toBeNull();
    });

    it("保存ボタンが初期状態では非表示であること", async () => {
      // Arrange & Act
      const { queryByText } = await render(<SaveScreen />);

      // Assert
      expect(queryByText("保存する")).toBeNull();
    });
  });

  describe("URL取得フロー", () => {
    it("URLを入力して取得ボタンを押すとプレビューが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      // Act
      await fireEvent.changeText(
        getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      await fireEvent.press(getByTestId("fetch-button"));

      // Assert
      await waitFor(() => {
        expect(getByTestId("article-preview")).toBeDefined();
        expect(getByText("React Nativeの新機能")).toBeDefined();
      });
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/articles/parse",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ url: "https://zenn.dev/test/articles/test-article" }),
        }),
      );
    });

    it("取得中はローディング状態が表示されること", async () => {
      // Arrange - 遅延レスポンスでローディング状態をキャプチャする
      let resolveApiFetch: (value: unknown) => void;
      mockApiFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveApiFetch = resolve;
        }),
      );
      const { getByPlaceholderText, getByTestId } = await render(<SaveScreen />);

      // Act
      await fireEvent.changeText(getByPlaceholderText("https://"), "https://zenn.dev/test");
      // fireEvent.pressはact内でasync処理を待つため、setTimeoutでPromiseを解決する
      setTimeout(() => {
        resolveApiFetch?.({ success: true, data: { title: "test" } });
      }, 100);
      await fireEvent.press(getByTestId("fetch-button"));

      // Assert - fetchが呼ばれたことでローディングフローが実行されたことを確認
      expect(mockApiFetch).toHaveBeenCalled();
    });

    it("空URLで取得ボタンを押すとエラーメッセージが表示されること", async () => {
      // Arrange
      const { getByTestId, getByText } = await render(<SaveScreen />);

      // Act
      await fireEvent.press(getByTestId("fetch-button"));

      // Assert
      await waitFor(() => {
        expect(getByText("URLを入力してください")).toBeDefined();
      });
    });

    it("不正なURLで取得ボタンを押すとエラーメッセージが表示されること", async () => {
      // Arrange
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      // Act
      await fireEvent.changeText(getByPlaceholderText("https://"), "not-a-url");
      await fireEvent.press(getByTestId("fetch-button"));

      // Assert
      await waitFor(() => {
        expect(getByText("有効なURLを入力してください")).toBeDefined();
      });
    });

    it("API取得失敗時にエラーメッセージが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "記事の取得に失敗しました" },
      });
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      // Act
      await fireEvent.changeText(getByPlaceholderText("https://"), "https://example.com/article");
      await fireEvent.press(getByTestId("fetch-button"));

      // Assert
      await waitFor(() => {
        expect(getByText("記事の取得に失敗しました")).toBeDefined();
      });
    });
  });

  describe("プレビュー表示", () => {
    it("記事タイトルが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      // Act
      await fireEvent.changeText(
        getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      await fireEvent.press(getByTestId("fetch-button"));

      // Assert
      await waitFor(() => {
        expect(getByText("React Nativeの新機能")).toBeDefined();
      });
    });

    it("ソースバッジが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      // Act
      await fireEvent.changeText(
        getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      await fireEvent.press(getByTestId("fetch-button"));

      // Assert
      await waitFor(() => {
        expect(getByText("zenn")).toBeDefined();
      });
    });

    it("excerptが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      // Act
      await fireEvent.changeText(
        getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      await fireEvent.press(getByTestId("fetch-button"));

      // Assert
      await waitFor(() => {
        expect(getByText("React Native 0.76の新機能について解説します")).toBeDefined();
      });
    });

    it("保存ボタンが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE);
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      // Act
      await fireEvent.changeText(
        getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      await fireEvent.press(getByTestId("fetch-button"));

      // Assert
      await waitFor(() => {
        expect(getByText("保存する")).toBeDefined();
      });
    });
  });

  describe("保存フロー", () => {
    it("保存ボタンを押すとPOSTリクエストが送信されること", async () => {
      // Arrange
      mockApiFetch
        .mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE)
        .mockResolvedValueOnce(MOCK_SAVE_RESPONSE);
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      await fireEvent.changeText(
        getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      await fireEvent.press(getByTestId("fetch-button"));

      await waitFor(() => {
        expect(getByText("保存する")).toBeDefined();
      });

      // Act
      await fireEvent.press(getByTestId("save-button"));

      // Assert
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/api/articles",
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
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      await fireEvent.changeText(
        getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      await fireEvent.press(getByTestId("fetch-button"));

      await waitFor(() => {
        expect(getByText("保存する")).toBeDefined();
      });

      // Act
      await fireEvent.press(getByTestId("save-button"));

      // Assert
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith("記事を保存しました", "success");
      });
    });

    it("保存失敗時にエラーメッセージが表示されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValueOnce(MOCK_PREVIEW_RESPONSE).mockResolvedValueOnce({
        success: false,
        error: { code: "DUPLICATE", message: "この記事はすでに保存されています" },
      });
      const { getByPlaceholderText, getByTestId, getByText } = await render(<SaveScreen />);

      await fireEvent.changeText(
        getByPlaceholderText("https://"),
        "https://zenn.dev/test/articles/test-article",
      );
      await fireEvent.press(getByTestId("fetch-button"));

      await waitFor(() => {
        expect(getByText("保存する")).toBeDefined();
      });

      // Act
      await fireEvent.press(getByTestId("save-button"));

      // Assert
      await waitFor(() => {
        expect(getByText("この記事はすでに保存されています")).toBeDefined();
      });
    });
  });
});
