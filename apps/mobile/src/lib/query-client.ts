import { QueryClient } from "@tanstack/react-query";

/** stale判定時間（5分） */
const STALE_TIME_MS = 1000 * 60 * 5;
/** ガベージコレクション時間（30分） */
const GC_TIME_MS = 1000 * 60 * 30;
/** テスト環境フラグ */
const IS_TEST = process.env.NODE_ENV === "test";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: IS_TEST ? 0 : GC_TIME_MS,
      retry: IS_TEST ? false : 2,
    },
  },
});
