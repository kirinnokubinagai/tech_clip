import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

import { apiFetch } from "@/lib/api";
import { LIGHT_COLORS } from "@/lib/constants";
import i18n from "@/lib/i18n";
import { logger } from "@/lib/logger";

/** Android通知チャンネルID */
const NOTIFICATION_CHANNEL_ID = "default";

/** 通知タップ時の許可URLパターン */
const ALLOWED_PUSH_PATTERNS = ["/articles", "/profile", "/settings"];

/**
 * 通知URLがアプリ内の許可されたルートかどうかを検証する
 *
 * @param url - 検証するURL文字列
 * @returns 許可されたルートの場合 true
 */
function isAllowedRoute(url: string): url is `/${string}` {
  return ALLOWED_PUSH_PATTERNS.some((pattern) => url === pattern || url.startsWith(`${pattern}/`));
}

/** 通知権限ステータス */
export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

/**
 * 文字列が NotificationPermissionStatus かどうかを検証する型ガード
 *
 * @param value - 検証する値
 * @returns NotificationPermissionStatus の場合 true
 */
function isNotificationPermissionStatus(value: string): value is NotificationPermissionStatus {
  return value === "granted" || value === "denied" || value === "undetermined";
}

/**
 * 現在の通知権限ステータスを確認する（ダイアログは表示しない）
 * シミュレータでは "undetermined" を返す
 *
 * @returns 通知権限ステータス
 */
export async function checkNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!Device.isDevice) {
    return "undetermined";
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (!isNotificationPermissionStatus(status)) {
    return "undetermined";
  }
  return status;
}

/**
 * 通知権限をユーザーに要求する
 * 既に許可済みの場合はリクエストをスキップする
 * シミュレータでは "undetermined" を返す
 *
 * @returns 要求後の通知権限ステータス
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!Device.isDevice) {
    return "undetermined";
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") {
    return "granted";
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (!isNotificationPermissionStatus(status)) {
    return "undetermined";
  }
  return status;
}

/**
 * プッシュトークンをAPIサーバーに登録する
 *
 * @param token - Expoプッシュトークン文字列
 */
async function registerTokenWithApi(token: string): Promise<void> {
  await apiFetch("/api/notifications/register", {
    method: "POST",
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
}

/**
 * 既に権限が granted であることを前提にトークン取得とAPI登録のみを行う
 * 権限要求は行わない（呼び出し側が事前に権限を確認・取得済みであること）
 * エラーはすべてログに記録し、例外を外部に伝播させない
 */
export async function registerPushTokenOnly(): Promise<void> {
  try {
    if (!Device.isDevice) {
      return;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: i18n.t("notifications.androidChannelName"),
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: LIGHT_COLORS.accent,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync();

    await registerTokenWithApi(token);
    logger.info("プッシュトークンのAPI登録に成功しました（権限確認済み）", {
      tokenPrefix: `${token.slice(0, 20)}...`,
    });
  } catch (error: unknown) {
    logger.error("プッシュトークンのAPI登録に失敗しました", { error });
  }
}

/**
 * 通知ハンドラーとリスナーを設定する
 * アプリ起動時に呼び出し、アンマウント時にクリーンアップ関数を実行すること
 *
 * @returns リスナー解除用のクリーンアップ関数
 */
export function setupNotificationHandlers(): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async (
      _notification: Notifications.Notification,
    ): Promise<Notifications.NotificationBehavior> => {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      } as Notifications.NotificationBehavior;
    },
  });

  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    logger.info("フォアグラウンド通知を受信しました", {
      title: notification.request.content.title,
    });
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === "string" && isAllowedRoute(url)) {
      router.push(url);
      return;
    }
    if (typeof url === "string") {
      logger.warn("許可されていない通知URLをブロックしました", { url });
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
