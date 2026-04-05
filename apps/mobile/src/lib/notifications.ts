import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiFetch } from "@/lib/api";
import { LIGHT_COLORS } from "@/lib/constants";
import { logger } from "@/lib/logger";

/** Android通知チャンネルID */
const NOTIFICATION_CHANNEL_ID = "default";

/** 通知権限ステータス */
export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

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
  return status as NotificationPermissionStatus;
}

/**
 * 通知権限をユーザーに要求する
 * シミュレータでは "undetermined" を返す
 *
 * @returns 要求後の通知権限ステータス
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!Device.isDevice) {
    return "undetermined";
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status as NotificationPermissionStatus;
}

/**
 * プッシュ通知の権限を要求し、Expoプッシュトークンを取得する
 * 実機でのみ動作し、シミュレータではnullを返す
 *
 * @returns Expoプッシュトークン文字列。取得不可の場合はnull
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: NOTIFICATION_CHANNEL_ID,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: LIGHT_COLORS.accent,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync();

  return token;
}

/**
 * プッシュトークンをAPIサーバーに登録する
 *
 * @param token - Expoプッシュトークン文字列
 */
export async function registerTokenWithApi(token: string): Promise<void> {
  await apiFetch("/api/notifications/register", {
    method: "POST",
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
}

/**
 * プッシュ通知権限を要求し、トークンを取得してAPIに登録する
 * エラーはすべてログに記録し、例外を外部に伝播させない
 * 通知関連機能の初回使用時またはユーザーが設定から許可した際に呼び出す
 */
export async function registerForPushNotificationsWithLogging(): Promise<void> {
  const token = await registerForPushNotifications();

  if (!token) {
    return;
  }

  try {
    await registerTokenWithApi(token);
    logger.info("プッシュトークンのAPI登録に成功しました", {
      token: `${token.slice(0, 20)}...`,
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

  const receivedSubscription = Notifications.addNotificationReceivedListener((_notification) => {
    /* フォアグラウンド通知受信時の処理 */
  });

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (_response) => {
      /* 通知タップ時の処理 */
    },
  );

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
