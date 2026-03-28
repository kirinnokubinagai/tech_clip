import { create } from "zustand";

import { SessionExpiredError, apiFetch } from "@/lib/api";
import { clearAuthTokens, getAuthToken, setAuthToken } from "@/lib/secure-store";
import type { AuthErrorResponse, Session, SignInParams, SignInResponse, User } from "@/types/auth";

/** セッション期限切れメッセージ */
const SESSION_EXPIRED_MESSAGE = "セッションの有効期限が切れました。再度ログインしてください";

type AuthStore = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** セッション期限切れ時に表示するメッセージ。nullの場合は表示しない */
  sessionExpiredMessage: string | null;
  signIn: (params: SignInParams) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  /** セッション期限切れを処理する。トークンをクリアしてログイン画面へ誘導する */
  handleSessionExpired: () => Promise<void>;
  /** セッション期限切れメッセージをクリアする */
  clearSessionExpiredMessage: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  sessionExpiredMessage: null,

  /**
   * メールとパスワードでサインインする
   *
   * @param params - メールアドレスとパスワード
   * @throws Error - 認証失敗時
   */
  signIn: async (params: SignInParams) => {
    const data = await apiFetch<SignInResponse | AuthErrorResponse>("/auth/sign-in", {
      method: "POST",
      body: JSON.stringify(params),
    });

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
        { success: true; data: { user: User; session: Session } } | AuthErrorResponse
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
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        await clearAuthTokens();
        set({
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          sessionExpiredMessage: SESSION_EXPIRED_MESSAGE,
        });
        return;
      }

      await clearAuthTokens();
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  /**
   * セッション期限切れを処理する
   * トークンをクリアし、ログイン画面へ誘導するためのメッセージを設定する
   */
  handleSessionExpired: async () => {
    await clearAuthTokens();

    set({
      user: null,
      session: null,
      isAuthenticated: false,
      sessionExpiredMessage: SESSION_EXPIRED_MESSAGE,
    });
  },

  /**
   * セッション期限切れメッセージをクリアする
   * ログイン画面でメッセージを表示した後に呼び出す
   */
  clearSessionExpiredMessage: () => {
    set({ sessionExpiredMessage: null });
  },
}));
