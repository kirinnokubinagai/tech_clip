import { useQuery } from "@tanstack/react-query";

import type { PublicProfile } from "@tech-clip/types";

import { apiFetch } from "@/lib/api";

/** 公開プロフィールのクエリキー */
const USER_PROFILE_QUERY_KEY = "user-profile";

/** 公開プロフィールの stale 判定時間（1分・ミリ秒） */
const PROFILE_STALE_TIME_MS = 60 * 1000;

/** 公開プロフィールAPIのレスポンス型 */
type UserPublicProfileResponse =
  | {
      success: true;
      data: PublicProfile;
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
async function fetchUserProfile(userId: string): Promise<PublicProfile> {
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
    staleTime: PROFILE_STALE_TIME_MS,
  });
}
