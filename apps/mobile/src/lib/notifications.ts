import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { Platform } from "react-native";
import { apiFetch } from "@/lib/api";
import { LIGHT_COLORS } from "@/lib/constants";
import { logger } from "@/lib/logger";

/** Android通知チャンネルID */
const NOTIFICATION_CHANNEL_ID = "default";

/** ログ出力時のトークン表示文字数 */
const TOKEN_LOG_PREFIX_LENGTH = 6;

/**
 * 通知タップ時の許可URLパターン
 * - /articles: 記事一覧・個別記事への遷移
 * - /profile: ユーザープロフィール画面
 * - /settings: 設定画面
 * 注意: /onboarding は既存ユーザー向けプッシュ通知での遷移先として使用しない。
 * 新規インストール後の初回フロー誘導のみ onboarding を使うため、ここには含めない。
 */
const ALLOWED_PUSH_PATTERNS = ["/articles", "/profile", "/settings"];

/**
 * 通知URLがアプリ内の許可されたルートかどうかを検証し、正規化されたパスを返す
 * URLエンコードされたパストラバーサル（%2e%2e 等）対策として
 * decodeURIComponent で復号後に正規化してからチェックし、
 * 正規化済みのパスを router.push に渡すことでエンコード差異を防ぐ
 *
 * @param url - 検証するURL文字列
 * @returns 許可されたルートの場合は正規化されたパス文字列、許可されない場合は null
 */
function getNormalizedAllowedRoute(url: string): string | null {
  try {
    const decoded = decodeURIComponent(url);
    const normalized = new URL(decoded, "app://app").pathname;
    if (
      ALLOWED_PUSH_PATTERNS.some(
        (pattern) => normalized === pattern || normalized.startsWith(`${pattern}/`),
      )
    ) {
      return normalized;
    }
    return null;
  } catch {
    return null;
  }
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
 * 既に許可済み・拒否済みの場合はリクエストをスキップする
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
  if (existingStatus === "denied") {
    return "denied";
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
export async function registerTokenWithApi(token: string): Promise<void> {
  await apiFetch("/api/notifications/register", {
    method: "POST",
    body: JSON.stringify({ token, platform: Platform.OS }),
  });
}

/**
 * 通知権限を確認し、granted の場合のみトークン取得とAPI登録を行う
 * 権限要求は行わない。権限が未付与の場合はスキップしてログを出力する。
 * エラーはすべてログに記録し、例外を外部に伝播させない
 *
 * @returns void（エラー時も例外を投げず、ログに記録して終了する）
 */
export async function registerPushTokenOnly(): Promise<void> {
  try {
    if (!Device.isDevice) {
      return;
    }

    const permission = await checkNotificationPermission();
    if (permission !== "granted") {
      logger.warn("通知権限が付与されていないためトークン登録をスキップします", { permission });
      return;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: NOTIFICATION_CHANNEL_ID,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: LIGHT_COLORS.accent,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync();

    await registerTokenWithApi(token);
    logger.info("プッシュトークンのAPI登録に成功しました（権限確認済み）", {
      tokenPrefix: `${token.slice(0, TOKEN_LOG_PREFIX_LENGTH)}...`,
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
    if (typeof url !== "string") {
      return;
    }

    const normalizedRoute = getNormalizedAllowedRoute(url);
    if (normalizedRoute !== null) {
      router.push(normalizedRoute as Href);
      return;
    }

    logger.warn("許可されていない通知URLをブロックしました", { url });
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
