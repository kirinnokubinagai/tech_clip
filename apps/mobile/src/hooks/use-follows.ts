import { useInfiniteQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

/** フォロワー/フォロー中一覧のクエリキー */
const FOLLOWERS_QUERY_KEY = "followers";

/** フォロー中一覧のクエリキー */
const FOLLOWING_QUERY_KEY = "following";

/** ページネーションのデフォルト取得件数 */
const DEFAULT_PAGE_LIMIT = 20;

/** フォローリストのユーザーアイテム型 */
export type FollowUserItem = {
  id: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

/** フォロー一覧APIレスポンス型 */
type FollowListResponse = {
  success: true;
  data: FollowUserItem[];
  meta: {
    nextCursor: string | null;
    hasNext: boolean;
  };
};

/** フォロー一覧ページ型 */
type FollowListPage = {
  items: FollowUserItem[];
  nextCursor: string | null;
  hasNext: boolean;
};

/**
 * フォローリストをAPIから取得する共通ヘルパー
 *
 * @param userId - 対象ユーザーID
 * @param cursor - ページネーションカーソル
 * @param segment - URLセグメント（"followers" または "following"）
 * @param errorMessage - 失敗時に throw するエラーメッセージ
 * @returns フォローリストページデータ
 */
async function fetchFollowList(
  userId: string,
  cursor: string | undefined,
  segment: "followers" | "following",
  errorMessage: string,
): Promise<FollowListPage> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", String(DEFAULT_PAGE_LIMIT));

  const queryString = params.toString();
  const path = `/api/users/${userId}/${segment}${queryString ? `?${queryString}` : ""}`;

  const response = await apiFetch<FollowListResponse>(path);

  if (!response.success) {
    throw new Error(errorMessage);
  }

  return {
    items: response.data,
    nextCursor: response.meta.nextCursor,
    hasNext: response.meta.hasNext,
  };
}

/**
 * フォロワー一覧をAPIから取得する
 *
 * @param userId - 対象ユーザーID
 * @param cursor - ページネーションカーソル
 * @returns フォロワー一覧データ
 */
async function fetchFollowers(userId: string, cursor: string | undefined): Promise<FollowListPage> {
  return fetchFollowList(userId, cursor, "followers", "フォロワー一覧の取得に失敗しました");
}

/**
 * フォロー中一覧をAPIから取得する
 *
 * @param userId - 対象ユーザーID
 * @param cursor - ページネーションカーソル
 * @returns フォロー中一覧データ
 */
async function fetchFollowing(userId: string, cursor: string | undefined): Promise<FollowListPage> {
  return fetchFollowList(userId, cursor, "following", "フォロー中一覧の取得に失敗しました");
}

/**
 * フォロワー一覧を取得するhook（無限スクロール対応）
 *
 * @param userId - 対象ユーザーID
 * @returns TanStack QueryのuseInfiniteQuery結果
 */
export function useFollowers(userId: string) {
  return useInfiniteQuery({
    queryKey: [FOLLOWERS_QUERY_KEY, userId],
    queryFn: ({ pageParam }) => fetchFollowers(userId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
    enabled: !!userId,
  });
}

/**
 * フォロー中一覧を取得するhook（無限スクロール対応）
 *
 * @param userId - 対象ユーザーID
 * @returns TanStack QueryのuseInfiniteQuery結果
 */
export function useFollowing(userId: string) {
  return useInfiniteQuery({
    queryKey: [FOLLOWING_QUERY_KEY, userId],
    queryFn: ({ pageParam }) => fetchFollowing(userId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
    enabled: !!userId,
  });
}
