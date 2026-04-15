import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import type { AppStateStatus, NativeEventSubscription } from "react-native";
import { AppState } from "react-native";

import { syncAllForOffline } from "./syncManager";

/**
 * バックグラウンド同期の最小間隔（ミリ秒）
 * iOS Background App Refresh の推奨間隔: 15分
 * Android WorkManager の最小間隔: 15分
 */
const BACKGROUND_SYNC_INTERVAL_MS = 15 * 60 * 1000;

/**
 * ネイティブバックグラウンドフェッチの最小間隔（秒）
 */
const BACKGROUND_FETCH_MIN_INTERVAL_SECONDS = 15 * 60;

/**
 * バックグラウンド同期の設定
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

/**
 * バックグラウンドフェッチタスク定義（モジュールトップレベルで呼ぶ必要がある）
 * OSがアプリをバックグラウンドで起動した際にタスクが見つかるようにする
 */
TaskManager.defineTask(DEFAULT_BACKGROUND_SYNC_CONFIG.taskName, async () => {
  try {
    const result = await syncAllForOffline();
    const hasNewData = result.contentsPrefetched + result.listSynced > 0;
    const allFailed = !hasNewData && result.errors.length > 0;
    if (allFailed) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
    if (!hasNewData) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * expo-background-fetch タスク登録オプション
 *
 * - stopOnTerminate: false → アプリ終了後もバックグラウンドフェッチを継続（Android）
 * - startOnBoot: true → 端末再起動後に自動再登録（Android）
 */
export const BACKGROUND_FETCH_OPTIONS: BackgroundFetch.BackgroundFetchOptions = {
  minimumInterval: BACKGROUND_FETCH_MIN_INTERVAL_SECONDS,
  stopOnTerminate: false,
  startOnBoot: true,
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
    syncAllForOffline().catch(() => {
      /* バックグラウンド同期エラーは無視（次回復帰時に再試行） */
    });
  };
}

/**
 * ネイティブバックグラウンドフェッチタスクを登録する
 *
 * TaskManager.defineTask でタスクを定義し、BackgroundFetch.registerTaskAsync で
 * OSレベルのバックグラウンドフェッチに登録する。
 * 登録に失敗した場合はエラーをスローせず、フォアグラウンド復帰時同期にフォールバックする。
 *
 * @param config - バックグラウンド同期設定
 */
export async function registerNativeBackgroundFetch(config: BackgroundSyncConfig): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(config.taskName, BACKGROUND_FETCH_OPTIONS);
  } catch {
    /* 登録失敗時はフォアグラウンド復帰時同期にフォールバック */
  }
}

/**
 * ネイティブバックグラウンドフェッチタスクを解除する
 *
 * @param taskName - 解除するタスク識別子
 */
export async function unregisterNativeBackgroundFetch(taskName: string): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(taskName);
  } catch {
    /* 解除失敗時は無視 */
  }
}

/**
 * バックグラウンド同期を開始する
 *
 * AppState の変化を監視し、アプリがフォアグラウンドに復帰した際に
 * 設定された間隔が経過していれば記事を同期する。
 * ネイティブバックグラウンドフェッチの補完として機能する。
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
