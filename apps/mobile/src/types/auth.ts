export type User = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  token: string;
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

export type AuthErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};
