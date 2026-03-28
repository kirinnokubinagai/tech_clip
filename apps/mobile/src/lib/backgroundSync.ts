import { AppState } from "react-native";

import { syncArticles } from "./syncManager";

import type { AppStateStatus, NativeEventSubscription } from "react-native";

/**
 * バックグラウンド同期の最小間隔（ミリ秒）
 * iOS Background App Refresh の推奨間隔: 15分
 * Android WorkManager の最小間隔: 15分
 */
const BACKGROUND_SYNC_INTERVAL_MS = 15 * 60 * 1000;

/**
 * バックグラウンド同期の設定
 *
 * expo-background-fetch / expo-task-manager が未インストールのため、
 * AppState を利用したフォアグラウンド復帰時同期で代替する。
 *
 * ネイティブバックグラウンド同期を有効化する場合は、以下を追加すること:
 *   - iOS: expo-background-fetch + expo-task-manager
 *   - Android: expo-background-fetch (WorkManager を内部利用)
 *   - app.json の ios.infoPlist に UIBackgroundModes: ["fetch"] を追加
 *   - app.json の android.permissions に
 *     RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE を追加
 *
 * @see https://docs.expo.dev/versions/latest/sdk/background-fetch/
 */
export type BackgroundSyncConfig = {
  /** 同期間隔（ミリ秒） */
  intervalMs: number;
  /** タスク識別子（ネイティブ登録時に使用） */
  taskName: string;
};

/** デフォルト設定 */
export const DEFAULT_BACKGROUND_SYNC_CONFIG: BackgroundSyncConfig = {
  intervalMs: BACKGROUND_SYNC_INTERVAL_MS,
  taskName: "BACKGROUND_SYNC_ARTICLES",
};

/** AppState 変化ハンドラーの型 */
type AppStateChangeHandler = (nextState: AppStateStatus) => void;

/**
 * バックグラウンド同期マネージャーの状態
 */
type BackgroundSyncState = {
  lastSyncedAt: number | null;
  subscription: NativeEventSubscription | null;
};

const state: BackgroundSyncState = {
  lastSyncedAt: null,
  subscription: null,
};

/**
 * 同期間隔が経過しているか確認する
 *
 * @param lastSyncedAt - 最終同期時刻（Unixミリ秒）またはnull
 * @param intervalMs - 同期間隔（ミリ秒）
 * @returns 同期が必要な場合はtrue
 */
export function isSyncDue(lastSyncedAt: number | null, intervalMs: number): boolean {
  if (lastSyncedAt === null) {
    return true;
  }
  return Date.now() - lastSyncedAt >= intervalMs;
}

/**
 * AppState 変化ハンドラーを作成する
 *
 * @param config - バックグラウンド同期設定
 * @returns AppState 変化時に呼び出されるハンドラー
 */
export function createAppStateHandler(config: BackgroundSyncConfig): AppStateChangeHandler {
  return (nextState: AppStateStatus): void => {
    if (nextState !== "active") {
      return;
    }
    if (!isSyncDue(state.lastSyncedAt, config.intervalMs)) {
      return;
    }
    state.lastSyncedAt = Date.now();
    syncArticles().catch(() => {
      /* バックグラウンド同期エラーは無視（次回復帰時に再試行） */
    });
  };
}

/**
 * バックグラウンド同期を開始する
 *
 * AppState の変化を監視し、アプリがフォアグラウンドに復帰した際に
 * 設定された間隔が経過していれば記事を同期する。
 *
 * @param config - バックグラウンド同期設定（省略時はデフォルト設定を使用）
 * @returns 購読解除用のクリーンアップ関数
 */
export function startBackgroundSync(
  config: BackgroundSyncConfig = DEFAULT_BACKGROUND_SYNC_CONFIG,
): () => void {
  if (state.subscription !== null) {
    state.subscription.remove();
    state.subscription = null;
  }

  const handler = createAppStateHandler(config);
  state.subscription = AppState.addEventListener("change", handler);

  return () => {
    if (state.subscription !== null) {
      state.subscription.remove();
      state.subscription = null;
    }
  };
}

/**
 * バックグラウンド同期の最終実行時刻を返す
 *
 * @returns 最終同期時刻（Unixミリ秒）またはnull
 */
export function getLastSyncedAt(): number | null {
  return state.lastSyncedAt;
}

/**
 * テスト用: 内部状態をリセットする
 */
export function resetBackgroundSyncState(): void {
  if (state.subscription !== null) {
    state.subscription.remove();
    state.subscription = null;
  }
  state.lastSyncedAt = null;
}
