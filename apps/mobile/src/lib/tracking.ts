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
type ExpoTrackingModule = {
  requestTrackingPermissionsAsync: () => Promise<{ status: string }>;
  getTrackingPermissionsAsync: () => Promise<{ status: string }>;
};

/**
 * 文字列が TrackingStatus かどうかを検証する型ガード
 *
 * @param value - 検証する値
 * @returns TrackingStatus の場合 true
 */
function isTrackingStatus(value: string): value is TrackingStatus {
  return ["authorized", "denied", "not-determined", "restricted", "unavailable"].includes(value);
}

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

  const mod = await import("expo-tracking-transparency").catch(() => null);
  if (!mod) {
    return "unavailable";
  }
  const { status } = await (mod as ExpoTrackingModule).requestTrackingPermissionsAsync();
  return isTrackingStatus(status) ? status : "unavailable";
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

  const mod = await import("expo-tracking-transparency").catch(() => null);
  if (!mod) {
    return "unavailable";
  }
  const { status } = await (mod as ExpoTrackingModule).getTrackingPermissionsAsync();
  return isTrackingStatus(status) ? status : "unavailable";
}
