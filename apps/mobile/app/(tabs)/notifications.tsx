import { BellOff, CheckCheck, RefreshCw } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { NotificationItem } from "@/components/NotificationItem";
import { EmptyState } from "@/components/ui";
import { useMarkAllAsRead, useMarkAsRead, useNotifications } from "@/hooks/use-notifications";
import type { NotificationItem as NotificationItemType } from "@/types/notification";

/** ローディングインジケーターの色 */
const LOADING_COLOR = "#6366f1";

/** ヘッダーアイコンサイズ */
const HEADER_ICON_SIZE = 20;

/** 空状態アイコンサイズ */
const EMPTY_ICON_SIZE = 48;

/** 空状態アイコン色 */
const EMPTY_ICON_COLOR = "#64748b";

/**
 * 通知一覧画面
 *
 * FlatListで通知を表示する。プルリフレッシュ、無限スクロール、
 * 全既読、個別既読に対応。
 */
export default function NotificationsScreen() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useNotifications();

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const handleNotificationPress = useCallback(
    (notification: NotificationItemType) => {
      if (!notification.isRead) {
        markAsRead.mutate(notification.id);
      }
    },
    [markAsRead],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead.mutate();
  }, [markAllAsRead]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationItemType }) => (
      <NotificationItem
        notification={item}
        onPress={() => handleNotificationPress(item)}
      />
    ),
    [handleNotificationPress],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={LOADING_COLOR} />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    if (isError) {
      return (
        <View className="flex-1 items-center justify-center py-20">
          <Text className="text-text-muted text-base">通知の取得に失敗しました</Text>
          <Pressable
            testID="retry-button"
            onPress={() => refetch()}
            className="mt-4 flex-row items-center gap-2"
          >
            <RefreshCw size={HEADER_ICON_SIZE} color={LOADING_COLOR} />
            <Text className="text-primary">再試行</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <EmptyState
        icon={<BellOff size={EMPTY_ICON_SIZE} color={EMPTY_ICON_COLOR} />}
        title="通知はありません"
        description="新しい通知が届くとここに表示されます"
      />
    );
  }, [isLoading, isError, refetch]);

  return (
    <View className="flex-1 bg-background">
      {notifications.length > 0 && (
        <View className="flex-row justify-end px-4 py-2">
          <Pressable
            testID="mark-all-read-button"
            onPress={handleMarkAllAsRead}
            className="flex-row items-center gap-1.5"
            accessibilityRole="button"
            accessibilityLabel="すべて既読にする"
          >
            <CheckCheck size={HEADER_ICON_SIZE} color={LOADING_COLOR} />
            <Text className="text-sm text-primary">すべて既読</Text>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="loading-indicator" size="large" color={LOADING_COLOR} />
          <Text className="text-text-muted mt-3">読み込み中...</Text>
        </View>
      ) : (
        <FlatList
          testID="notifications-list"
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={LOADING_COLOR}
            />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}
