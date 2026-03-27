import { create } from "zustand";

import { apiFetch } from "@/lib/api";
import {
  clearAuthTokens,
  getAuthToken,
  setAuthToken,
} from "@/lib/secure-store";
import type {
  AuthErrorResponse,
  Session,
  SignInParams,
  SignInResponse,
  User,
} from "@/types/auth";

type AuthStore = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (params: SignInParams) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,

  /**
   * メールとパスワードでサインインする
   *
   * @param params - メールアドレスとパスワード
   * @throws Error - 認証失敗時
   */
  signIn: async (params: SignInParams) => {
    const data = await apiFetch<SignInResponse | AuthErrorResponse>(
      "/auth/sign-in",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );

    if (!data.success) {
      throw new Error(data.error.message);
    }

    await setAuthToken(data.data.session.token);

    set({
      user: data.data.user,
      session: data.data.session,
      isAuthenticated: true,
    });
  },

  /**
   * サインアウトする
   * ローカルのトークンとストア状態をクリアする
   */
  signOut: async () => {
    await clearAuthTokens();

    set({
      user: null,
      session: null,
      isAuthenticated: false,
    });
  },

  /**
   * 保存済みトークンでセッションを復元する
   * アプリ起動時に呼び出す
   */
  checkSession: async () => {
    set({ isLoading: true });

    const token = await getAuthToken();

    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const data = await apiFetch<
        | { success: true; data: { user: User; session: Session } }
        | AuthErrorResponse
      >("/auth/session");

      if (!data.success) {
        await clearAuthTokens();
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      set({
        user: data.data.user,
        session: data.data.session,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      await clearAuthTokens();
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
