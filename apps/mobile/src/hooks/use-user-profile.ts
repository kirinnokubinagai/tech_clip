import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProfileHeaderUser } from "@/components/ProfileHeader";
import { followKeys } from "@/hooks/use-follow";
import { apiFetch } from "@/lib/api";

/** ユーザープロフィールのクエリキー */
export const USER_PROFILE_QUERY_KEY = "user-profile";

/** ユーザープロフィールAPIレスポンスの型 */
type UserProfileResponse = {
  success: true;
  data: ProfileHeaderUser & { id: string; isFollowing: boolean };
};

/** フォロートグルAPIレスポンスの型 */
type FollowToggleResponse = {
  success: true;
};

/**
 * ユーザープロフィールを取得するフック
 *
 * @param userId - ユーザーID
 * @returns ユーザープロフィールのクエリ結果
 */
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: [USER_PROFILE_QUERY_KEY, userId],
    queryFn: async () => {
      const data = await apiFetch<UserProfileResponse>(`/api/users/${userId}/profile`);
      return data.data;
    },
    enabled: !!userId,
  });
}

/**
 * フォロー/フォロー解除を切り替えるフック
 *
 * @returns フォロートグルのミューテーション
 */
export function useFollowToggle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isFollowing }: { userId: string; isFollowing: boolean }) => {
      const method = isFollowing ? "DELETE" : "POST";
      await apiFetch<FollowToggleResponse>(`/api/users/${userId}/follow`, { method });
    },
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: [USER_PROFILE_QUERY_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: followKeys.all });
    },
  });
}
