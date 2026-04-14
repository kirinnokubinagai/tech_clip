import { Bell, Heart, MessageCircle, Newspaper, UserPlus } from "lucide-react-native";
import { type ReactNode, useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { NotificationType } from "@/types/notification";
import { formatRelativeTime } from "@/utils/formatters";

/** NotificationItemに渡す通知データ */
export type NotificationItemData = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationItemProps = {
  notification: NotificationItemData;
  onPress: () => void;
};

/** 通知アイコンのサイズ（px） */
const NOTIFICATION_ICON_SIZE = 20;

/**
 * 通知種別に対応するアイコンを返す
 *
 * @param type - 通知種別
 * @param typeIconColors - テーマ連動のアイコン色マップ
 * @returns Lucideアイコンコンポーネント
 */
function getNotificationIcon(
  type: NotificationType,
  typeIconColors: Record<NotificationType, string>,
): ReactNode {
  const color = typeIconColors[type];

  switch (type) {
    case "like":
      return (
        <Heart
          testID="notification-icon-like"
          size={NOTIFICATION_ICON_SIZE}
          color={color}
          fill={color}
        />
      );
    case "comment":
      return (
        <MessageCircle
          testID="notification-icon-comment"
          size={NOTIFICATION_ICON_SIZE}
          color={color}
        />
      );
    case "follow":
      return (
        <UserPlus testID="notification-icon-follow" size={NOTIFICATION_ICON_SIZE} color={color} />
      );
    case "system":
      return <Bell testID="notification-icon-system" size={NOTIFICATION_ICON_SIZE} color={color} />;
    case "article":
      return (
        <Newspaper testID="notification-icon-article" size={NOTIFICATION_ICON_SIZE} color={color} />
      );
  }
}

/**
 * 通知リストアイテムコンポーネント
 *
 * 種別に応じたアイコン、タイトル、本文、相対時間、未読インジケーターを表示する。
 *
 * @param notification - 表示する通知データ
 * @param onPress - タップ時のコールバック
 */
export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const colors = useColors();

  /** 通知種別ごとのアイコン色 */
  const typeIconColors = useMemo<Record<NotificationType, string>>(
    () => ({
      like: colors.favorite,
      comment: colors.info,
      follow: colors.success,
      system: colors.warning,
      article: colors.primary,
    }),
    [colors],
  );

  return (
    <Pressable
      testID="notification-item"
      className={`flex-row items-start gap-3 px-4 py-3 ${notification.isRead ? "bg-background" : "bg-surface"}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={notification.title}
    >
      <View className="mt-0.5">{getNotificationIcon(notification.type, typeIconColors)}</View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center justify-between">
          <Text
            testID="notification-title"
            className={`text-sm flex-1 mr-2 ${notification.isRead ? "text-text-muted font-normal" : "text-text font-semibold"}`}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text testID="notification-time" className="text-xs text-text-dim">
              {formatRelativeTime(notification.createdAt)}
            </Text>
            {!notification.isRead && (
              <View
                testID="unread-indicator"
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors.primary }}
              />
            )}
          </View>
        </View>

        <Text testID="notification-body" className="text-xs text-text-muted" numberOfLines={2}>
          {notification.body}
        </Text>
      </View>
    </Pressable>
  );
}
