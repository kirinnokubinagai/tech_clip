import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import React from "react";

import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@mobile/hooks/use-notifications";
import { apiFetch } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = jest.mocked(apiFetch);

/** テスト用QueryClientを生成する */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** テスト用QueryClientProviderラッパーを生成する */
function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

/** テスト用通知アイテム */
const MOCK_NOTIFICATION_ITEM = {
  id: "notification-1",
  type: "follow" as const,
  title: "フォローされました",
  body: "テストユーザーさんにフォローされました",
  isRead: false,
  createdAt: "2024-01-01T00:00:00Z",
};

/** テスト用通知一覧APIレスポンス（最終ページ） */
const MOCK_NOTIFICATIONS_RESPONSE_LAST = {
  success: true,
  data: [MOCK_NOTIFICATION_ITEM],
  meta: { nextCursor: null, hasNext: false, unreadCount: 1 },
};

/** テスト用通知一覧APIレスポンス（次ページあり） */
const MOCK_NOTIFICATIONS_RESPONSE_HAS_NEXT = {
  success: true,
  data: [MOCK_NOTIFICATION_ITEM],
  meta: { nextCursor: "cursor-page2", hasNext: true, unreadCount: 1 },
};

/** テスト用未読数APIレスポンス */
const MOCK_UNREAD_COUNT_RESPONSE = {
  success: true,
  data: { count: 3 },
};

let queryClient: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = createTestQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

describe("useNotifications", () => {
  describe("正常系", () => {
    it("通知一覧を取得できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(MOCK_NOTIFICATIONS_RESPONSE_LAST);
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useNotifications(), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith(expect.stringContaining("/api/notifications"));
      expect(result.current.data?.pages).toHaveLength(1);
      expect(result.current.data?.pages[0].items).toHaveLength(1);
      expect(result.current.data?.pages[0].items[0].id).toBe("notification-1");
    });

    it("limitパラメータがデフォルト20で送信されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(MOCK_NOTIFICATIONS_RESPONSE_LAST);
      const wrapper = createWrapper(queryClient);

      // Act
      await renderHook(() => useNotifications(), { wrapper });

      // Assert
      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
      expect(mockApiFetch).toHaveBeenCalledWith(expect.stringContaining("limit=20"));
    });

    it("hasNextがfalseの場合にhasNextPageがfalseになること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(MOCK_NOTIFICATIONS_RESPONSE_LAST);
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useNotifications(), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
    });

    it("hasNextがtrueの場合にhasNextPageがtrueになること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(MOCK_NOTIFICATIONS_RESPONSE_HAS_NEXT);
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useNotifications(), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(true);
    });

    it("次のページ取得時にcursorパラメータが含まれること", async () => {
      // Arrange
      mockApiFetch
        .mockResolvedValueOnce(MOCK_NOTIFICATIONS_RESPONSE_HAS_NEXT)
        .mockResolvedValueOnce(MOCK_NOTIFICATIONS_RESPONSE_LAST);
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useNotifications(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Act
      await act(async () => {
        await result.current.fetchNextPage();
      });

      // Assert
      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2));
      expect(mockApiFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("cursor=cursor-page2"),
      );
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      mockApiFetch.mockRejectedValue(new Error("ネットワークエラー"));
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useNotifications(), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("APIがsuccess:falseを返した場合にエラー状態になること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        success: false,
        error: { code: "AUTH_REQUIRED", message: "ログインが必要です" },
      });
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useNotifications(), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("通知の取得に失敗しました");
    });
  });
});

describe("useUnreadNotificationCount", () => {
  describe("正常系", () => {
    it("未読通知数を取得できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue(MOCK_UNREAD_COUNT_RESPONSE);
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useUnreadNotificationCount(), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith("/api/notifications/unread-count");
      expect(result.current.data).toBe(3);
    });

    it("未読通知数が0の場合も正常に取得できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true, data: { count: 0 } });
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useUnreadNotificationCount(), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe(0);
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      mockApiFetch.mockRejectedValue(new Error("サーバーエラー"));
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useUnreadNotificationCount(), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("APIがsuccess:falseを返した場合にエラー状態になること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        success: false,
        error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" },
      });
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useUnreadNotificationCount(), { wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("未読通知数の取得に失敗しました");
    });
  });
});

describe("useMarkAsRead", () => {
  describe("正常系", () => {
    it("通知を既読にできること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true });
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useMarkAsRead(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate("notification-1");
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/notifications/notification-1/read",
        { method: "PATCH" },
      );
    });

    it("既読成功後に通知一覧と未読数のキャッシュが無効化されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true });
      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useMarkAsRead(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate("notification-1");
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["notifications"] }),
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["notifications-unread-count"] }),
      );
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      mockApiFetch.mockRejectedValue(new Error("既読処理に失敗しました"));
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useMarkAsRead(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate("notification-1");
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("既読処理に失敗しました");
    });
  });
});

describe("useMarkAllAsRead", () => {
  describe("正常系", () => {
    it("全通知を既読にできること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true });
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useMarkAllAsRead(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate();
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith("/api/notifications/read-all", {
        method: "PATCH",
      });
    });

    it("全既読成功後に通知一覧と未読数のキャッシュが無効化されること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true });
      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useMarkAllAsRead(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate();
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["notifications"] }),
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["notifications-unread-count"] }),
      );
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      mockApiFetch.mockRejectedValue(new Error("全既読処理に失敗しました"));
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useMarkAllAsRead(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate();
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("全既読処理に失敗しました");
    });
  });
});
