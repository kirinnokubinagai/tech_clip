export type User = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isProfilePublic: boolean;
  isPremium: boolean;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
};

/** 他ユーザーの公開プロフィール型 */
export type PublicProfile = {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  /** 現在ログイン中のユーザーがこのユーザーをフォローしているか。未ログイン時は false。 */
  isFollowing: boolean;
};
