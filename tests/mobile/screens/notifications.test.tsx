/**
 * 通知画面 英語ロケールテスト
 *
 * en ロケール設定時に主要 UI 文言が英語で表示されることを確認する。
 */
import NotificationsScreen from "@mobile-app/(tabs)/notifications";
import { render, waitFor } from "@testing-library/react-native";

import { setMockLocale } from "../helpers/i18n-test-utils";

jest.mock("@mobile/hooks/use-notifications", () => ({
  useNotifications: jest.fn(),
  useMarkAsRead: jest.fn(),
  useMarkAllAsRead: jest.fn(),
  useUnreadNotificationCount: jest.fn(),
}));

const { useNotifications, useMarkAsRead, useMarkAllAsRead } = jest.requireMock(
  "@mobile/hooks/use-notifications",
);

/** useNotifications のデフォルトモック値（読み込み中） */
const DEFAULT_NOTIFICATIONS_LOADING = {
  data: undefined,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: true,
  isError: false,
  refetch: jest.fn(),
  isRefetching: false,
};

/** useNotifications のデフォルトモック値（空） */
const DEFAULT_NOTIFICATIONS_EMPTY = {
  ...DEFAULT_NOTIFICATIONS_LOADING,
  isLoading: false,
  data: { pages: [] },
};

/** useNotifications のデフォルトモック値（エラー） */
const DEFAULT_NOTIFICATIONS_ERROR = {
  ...DEFAULT_NOTIFICATIONS_LOADING,
  isLoading: false,
  isError: true,
  data: undefined,
};

describe("NotificationsScreen", () => {
  beforeEach(() => {
    setMockLocale("ja");
    jest.clearAllMocks();
    useMarkAsRead.mockReturnValue({ mutate: jest.fn() });
    useMarkAllAsRead.mockReturnValue({ mutate: jest.fn() });
  });

  describe("日本語ロケール（デフォルト）", () => {
    it("ローディング中に読み込み中が表示されること", async () => {
      // Arrange
      useNotifications.mockReturnValue(DEFAULT_NOTIFICATIONS_LOADING);

      // Act
      const { getByTestId } = await render(<NotificationsScreen />);

      // Assert
      expect(getByTestId("loading-indicator")).toBeDefined();
    });

    it("空の状態で日本語メッセージが表示されること", async () => {
      // Arrange
      useNotifications.mockReturnValue(DEFAULT_NOTIFICATIONS_EMPTY);

      // Act
      const { getByText } = await render(<NotificationsScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("通知はありません。")).toBeDefined();
      });
    });

    it("エラー時に日本語エラーメッセージが表示されること", async () => {
      // Arrange
      useNotifications.mockReturnValue(DEFAULT_NOTIFICATIONS_ERROR);

      // Act
      const { getByText } = await render(<NotificationsScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("通知の取得に失敗しました。")).toBeDefined();
      });
    });

    it("エラー時に日本語再試行ボタンが表示されること", async () => {
      // Arrange
      useNotifications.mockReturnValue(DEFAULT_NOTIFICATIONS_ERROR);

      // Act
      const { getByText } = await render(<NotificationsScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("再試行")).toBeDefined();
      });
    });
  });

  describe("英語ロケール", () => {
    beforeEach(() => {
      setMockLocale("en");
    });

    afterEach(() => {
      setMockLocale("ja");
    });

    it("空の状態で英語メッセージが表示されること", async () => {
      // Arrange
      useNotifications.mockReturnValue(DEFAULT_NOTIFICATIONS_EMPTY);

      // Act
      const { getByText } = await render(<NotificationsScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("No notifications")).toBeDefined();
      });
    });

    it("エラー時に英語エラーメッセージが表示されること", async () => {
      // Arrange
      useNotifications.mockReturnValue(DEFAULT_NOTIFICATIONS_ERROR);

      // Act
      const { getByText } = await render(<NotificationsScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("Failed to fetch notifications")).toBeDefined();
      });
    });

    it("エラー時に英語再試行ボタンが表示されること", async () => {
      // Arrange
      useNotifications.mockReturnValue(DEFAULT_NOTIFICATIONS_ERROR);

      // Act
      const { getByText } = await render(<NotificationsScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("Retry")).toBeDefined();
      });
    });

    it("日本語「通知はありません」が表示されないこと", async () => {
      // Arrange
      useNotifications.mockReturnValue(DEFAULT_NOTIFICATIONS_EMPTY);

      // Act
      const { queryByText } = await render(<NotificationsScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByText("通知はありません。")).toBeNull();
      });
    });
  });
});
