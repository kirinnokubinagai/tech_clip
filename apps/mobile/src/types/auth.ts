export type User = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  avatarUrl?: string | null;
  username?: string | null;
  bio?: string | null;
  websiteUrl?: string | null;
  githubUsername?: string | null;
  twitterUsername?: string | null;
  isProfilePublic?: boolean | null;
  preferredLanguage?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  token: string;
  refreshToken: string;
  expiresAt: string;
};

export type AuthState = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

export type SignInParams = {
  email: string;
  password: string;
};

export type SignInResponse = {
  success: true;
  data: {
    user: User;
    session: Session;
  };
};

export type SignUpParams = {
  /** 表示名（省略可。省略時はサーバー側でメールアドレスの local-part を使用する） */
  name?: string;
  email: string;
  password: string;
};

export type SignUpResponse = {
  success: true;
  data: {
    user: User;
    session: Session | null;
  };
};

export type AuthErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};
