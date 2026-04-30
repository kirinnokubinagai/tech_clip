import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { SessionExpiredError } from "./api";

/** stale判定時間（5分） */
const STALE_TIME_MS = 1000 * 60 * 5;
/** ガベージコレクション時間（30分） */
const GC_TIME_MS = 1000 * 60 * 30;
/** テスト環境フラグ */
const IS_TEST = process.env.NODE_ENV === "test";

/**
 * SessionExpiredError をグローバルに処理する
 * auth-store は遅延インポートして循環依存を回避する
 */
async function handleGlobalError(error: unknown): Promise<void> {
  if (!(error instanceof SessionExpiredError)) {
    return;
  }
  const { useAuthStore } = await import("@/stores/auth-store");
  await useAuthStore.getState().handleSessionExpired();
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      void handleGlobalError(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      void handleGlobalError(error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: IS_TEST ? 0 : GC_TIME_MS,
      retry: IS_TEST ? false : 2,
    },
  },
});
