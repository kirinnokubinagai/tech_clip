import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { NotificationItem, NotificationsListResponse } from "@/types/notification";

/** 通知一覧のクエリキー */
const NOTIFICATIONS_QUERY_KEY = "notifications";

/** 未読通知数のクエリキー */
const UNREAD_COUNT_QUERY_KEY = "notifications-unread-count";

/** ページネーションのデフォルト取得件数 */
const DEFAULT_PAGE_LIMIT = 20;

/** 未読数ポーリング間隔（ミリ秒） */
const UNREAD_POLL_INTERVAL_MS = 30000;

/**
 * 通知一覧をAPIから取得する
 *
 * @param cursor - ページネーションカーソル
 * @returns 通知一覧データ
 */
async function fetchNotifications(
  cursor: string | undefined,
): Promise<{ items: NotificationItem[]; nextCursor: string | null; hasNext: boolean }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(DEFAULT_PAGE_LIMIT));

  const queryString = params.toString();
  const path = `/api/notifications${queryString ? `?${queryString}` : ""}`;

  const response = await apiFetch<NotificationsListResponse>(path);

  if (!response.success) {
    throw new Error("通知の取得に失敗しました");
  }

  return {
    items: response.data,
    nextCursor: response.meta.nextCursor,
    hasNext: response.meta.hasNext,
  };
}

/**
 * 未読通知数をAPIから取得する
 *
 * @returns 未読通知数
 */
async function fetchUnreadCount(): Promise<number> {
  const response = await apiFetch<{ success: true; data: { count: number } }>(
    "/api/notifications/unread-count",
  );

  if (!response.success) {
    throw new Error("未読通知数の取得に失敗しました");
  }

  return response.data.count;
}

/**
 * 通知一覧を取得するhook（無限スクロール対応）
 *
 * @returns TanStack QueryのuseInfiniteQuery結果
 */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: [NOTIFICATIONS_QUERY_KEY],
    queryFn: ({ pageParam }) => fetchNotifications(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
  });
}

/**
 * 未読通知数を取得するhook（ポーリング対応）
 *
 * @returns TanStack QueryのuseQuery結果
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [UNREAD_COUNT_QUERY_KEY],
    queryFn: fetchUnreadCount,
    refetchInterval: UNREAD_POLL_INTERVAL_MS,
  });
}

/**
 * 通知を既読にするmutation hook
 *
 * @returns TanStack QueryのuseMutation結果
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiFetch<{ success: boolean }>(
        `/api/notifications/${notificationId}/read`,
        { method: "PATCH" },
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_QUERY_KEY] });
    },
  });
}

/**
 * 全通知を既読にするmutation hook
 *
 * @returns TanStack QueryのuseMutation結果
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiFetch<{ success: boolean }>("/api/notifications/read-all", {
        method: "PATCH",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [UNREAD_COUNT_QUERY_KEY] });
    },
  });
}
