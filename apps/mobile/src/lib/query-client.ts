import { QueryClient } from "@tanstack/react-query";

/** stale判定時間（5分） */
const STALE_TIME_MS = 1000 * 60 * 5;
/** ガベージコレクション時間（30分） */
const GC_TIME_MS = 1000 * 60 * 30;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      retry: 2,
    },
  },
});
