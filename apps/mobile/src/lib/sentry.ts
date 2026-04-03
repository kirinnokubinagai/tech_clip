import * as Sentry from "@sentry/react-native";

/**
 * Sentry を初期化する
 *
 * DSN が未設定の場合は初期化をスキップする。
 * 開発環境（__DEV__ = true）では Sentry イベントを送信しない。
 *
 * @param dsn - Sentry DSN（環境変数 EXPO_PUBLIC_SENTRY_DSN から取得）
 */
export function initSentry(dsn: string | undefined): void {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    enableInExpoDevelopment: false,
    debug: __DEV__,
  });
}

/**
 * 例外を Sentry に送信する
 *
 * Sentry が未初期化の場合は送信をスキップする。
 *
 * @param error - キャプチャするエラー（Error オブジェクトまたは任意の値）
 */
export function captureException(error: unknown): void {
  if (!Sentry.isInitialized()) {
    return;
  }

  Sentry.captureException(error);
}
