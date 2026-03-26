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
