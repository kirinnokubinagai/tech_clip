import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiFetch } from "@/lib/api";

/** Android通知チャンネルID */
const NOTIFICATION_CHANNEL_ID = "default";

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
      lightColor: "#14b8a6",
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
  await apiFetch("/notifications/push-token", {
    method: "POST",
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
}

/**
 * 通知ハンドラーとリスナーを設定する
 * アプリ起動時に呼び出し、アンマウント時にクリーンアップ関数を実行すること
 *
 * @returns リスナー解除用のクリーンアップ関数
 */
export function setupNotificationHandlers(): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      };
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
