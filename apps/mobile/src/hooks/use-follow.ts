import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** フォロワー/フォロー中ユーザーの型 */
export type FollowUser = {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
};

/** フォロワー/フォロー中一覧レスポンスの型 */
type FollowListResponse = {
  success: true;
  data: FollowUser[];
};

/** フォロークエリキーファクトリー */
export const followKeys = {
  all: ["follow"] as const,
  followers: (userId?: string) => [...followKeys.all, "followers", userId] as const,
  following: (userId?: string) => [...followKeys.all, "following", userId] as const,
};

/**
 * フォロワー一覧を取得するフック
 *
 * @param userId - ユーザーID
 * @param options - React Query オプション
 * @returns フォロワー一覧のクエリ結果
 */
export function useFollowers(userId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: followKeys.followers(userId),
    queryFn: async () => {
      const path = userId ? `/api/users/${userId}/followers` : "/api/users/me/followers";
      const data = await apiFetch<FollowListResponse>(path);
      return data.data;
    },
    ...options,
  });
}

/**
 * フォロー中一覧を取得するフック
 *
 * @param userId - ユーザーID
 * @param options - React Query オプション
 * @returns フォロー中一覧のクエリ結果
 */
export function useFollowing(userId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: followKeys.following(userId),
    queryFn: async () => {
      const path = userId ? `/api/users/${userId}/following` : "/api/users/me/following";
      const data = await apiFetch<FollowListResponse>(path);
      return data.data;
    },
    ...options,
  });
}
