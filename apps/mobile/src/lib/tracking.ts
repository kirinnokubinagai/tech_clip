/**
 * App Tracking Transparency (ATT) ユーティリティ
 *
 * iOS 14.5以降でATT許可ダイアログを表示する。
 * expo-tracking-transparency パッケージが必要。
 * インストール: pnpm add expo-tracking-transparency --filter @tech-clip/mobile
 *
 * @see https://docs.expo.dev/versions/latest/sdk/tracking-transparency/
 */
import { Platform } from "react-native";

/**
 * ATT許可ステータス
 */
export type TrackingStatus =
  | "authorized"
  | "denied"
  | "not-determined"
  | "restricted"
  | "unavailable";

/**
 * expo-tracking-transparency モジュールの型定義
 */
type TrackingTransparencyModule = {
  requestTrackingPermissionsAsync: () => Promise<{ status: string }>;
  getTrackingPermissionsAsync: () => Promise<{ status: string }>;
};

/**
 * ATT許可リクエストを実行する
 *
 * iOS 14.5以降でのみダイアログを表示する。
 * expo-tracking-transparency が未インストールの場合は "unavailable" を返す。
 *
 * @returns 許可ステータス
 */
export async function requestTrackingPermission(): Promise<TrackingStatus> {
  if (Platform.OS !== "ios") {
    return "unavailable";
  }

  try {
    const trackingModule =
      // biome-ignore lint/suspicious/noExplicitAny: expo-tracking-transparency is an optional dependency
      (await import("expo-tracking-transparency" as never)) as unknown as TrackingTransparencyModule;
    const { status } = await trackingModule.requestTrackingPermissionsAsync();
    return status as TrackingStatus;
  } catch {
    return "unavailable";
  }
}

/**
 * 現在のATT許可ステータスを取得する
 *
 * @returns 許可ステータス
 */
export async function getTrackingStatus(): Promise<TrackingStatus> {
  if (Platform.OS !== "ios") {
    return "unavailable";
  }

  try {
    const trackingModule =
      // biome-ignore lint/suspicious/noExplicitAny: expo-tracking-transparency is an optional dependency
      (await import("expo-tracking-transparency" as never)) as unknown as TrackingTransparencyModule;
    const { status } = await trackingModule.getTrackingPermissionsAsync();
    return status as TrackingStatus;
  } catch {
    return "unavailable";
  }
}
