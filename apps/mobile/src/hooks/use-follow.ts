import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

/** フォロワー/フォロー中ユーザーの型 */
export type FollowUser = {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
};

/** フォロワー一覧レスポンスの型 */
type FollowersResponse = {
  success: true;
  data: FollowUser[];
};

/** フォロー中一覧レスポンスの型 */
type FollowingResponse = {
  success: true;
  data: FollowUser[];
};

/** フォロワー一覧のクエリキー */
const FOLLOWERS_QUERY_KEY = "followers";

/** フォロー中一覧のクエリキー */
const FOLLOWING_QUERY_KEY = "following";

/**
 * フォロワー一覧を取得するフック
 *
 * @param userId - ユーザーID
 * @returns フォロワー一覧のクエリ結果
 */
export function useFollowers(userId?: string) {
  return useQuery({
    queryKey: [FOLLOWERS_QUERY_KEY, userId],
    queryFn: async () => {
      const path = userId ? `/api/users/${userId}/followers` : "/api/users/me/followers";
      const data = await apiFetch<FollowersResponse>(path);
      return data.data;
    },
    enabled: true,
  });
}

/**
 * フォロー中一覧を取得するフック
 *
 * @param userId - ユーザーID
 * @returns フォロー中一覧のクエリ結果
 */
export function useFollowing(userId?: string) {
  return useQuery({
    queryKey: [FOLLOWING_QUERY_KEY, userId],
    queryFn: async () => {
      const path = userId ? `/api/users/${userId}/following` : "/api/users/me/following";
      const data = await apiFetch<FollowingResponse>(path);
      return data.data;
    },
    enabled: true,
  });
}
