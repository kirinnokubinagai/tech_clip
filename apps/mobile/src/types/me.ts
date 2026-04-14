/**
 * 自分のプロフィール情報の型
 * GET /api/users/me のレスポンスに対応する
 */
export type MeProfile = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  avatarUrl: string | null;
  username: string | null;
  bio: string | null;
  websiteUrl: string | null;
  githubUsername: string | null;
  twitterUsername: string | null;
  isProfilePublic: boolean | null;
  preferredLanguage: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * プロフィール更新のリクエスト型
 * PATCH /api/users/me のリクエストボディに対応する
 */
export type UpdateProfileInput = {
  name?: string | null;
  username?: string | null;
  bio?: string | null;
  websiteUrl?: string | null;
  githubUsername?: string | null;
  twitterUsername?: string | null;
};

/**
 * API のプロフィール取得レスポンス型
 */
export type MeProfileResponse = {
  success: true;
  data: MeProfile;
};

/**
 * API のプロフィール更新レスポンス型
 */
export type UpdateProfileResponse = {
  success: true;
  data: MeProfile;
};
