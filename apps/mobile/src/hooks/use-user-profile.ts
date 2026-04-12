import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

/** 公開プロフィールのクエリキー */
const USER_PROFILE_QUERY_KEY = "user-profile";

/** 公開プロフィールの型 */
export type UserPublicProfile = {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
};

/** 公開プロフィールAPIのレスポンス型 */
type UserPublicProfileResponse =
  | {
      success: true;
      data: UserPublicProfile;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

/**
 * ユーザーの公開プロフィールをAPIから取得する
 *
 * @param userId - 取得対象のユーザーID
 * @returns 公開プロフィールデータ
 * @throws APIエラー時
 */
async function fetchUserProfile(userId: string): Promise<UserPublicProfile> {
  const response = await apiFetch<UserPublicProfileResponse>(`/api/users/${userId}/profile`);

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data;
}

/**
 * 他ユーザーの公開プロフィールを取得する hook
 *
 * @param userId - 取得対象のユーザーID
 * @returns TanStack Query の useQuery 結果
 */
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: [USER_PROFILE_QUERY_KEY, userId],
    queryFn: () => fetchUserProfile(userId),
    enabled: !!userId,
  });
}
