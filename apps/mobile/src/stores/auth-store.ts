import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { apiFetch, SessionExpiredError } from "@/lib/api";
import { clearAuthTokens, getAuthToken, setAuthToken, setRefreshToken } from "@/lib/secure-store";
import type {
  AuthErrorResponse,
  Session,
  SignInParams,
  SignInResponse,
  SignUpParams,
  User,
} from "@/types/auth";

/** SecureStoreキー: アカウント作成済みフラグ */
const HAS_ACCOUNT_KEY = "hasAccount";

/** セッション期限切れメッセージ */
const SESSION_EXPIRED_MESSAGE = "セッションの有効期限が切れました。再度ログインしてください。";

type AuthStore = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** セッション期限切れ時に表示するメッセージ。nullの場合は表示しない */
  sessionExpiredMessage: string | null;
  /** 一度でもサインインまたはサインアップに成功したことを示すフラグ */
  hasAccount: boolean;
  /** SecureStoreからhasAccountフラグを読み込む */
  loadAccountFlag: () => Promise<void>;
  signIn: (params: SignInParams) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  /** セッション期限切れを処理する。トークンをクリアしてログイン画面へ誘導する */
  handleSessionExpired: () => Promise<void>;
  /** セッション期限切れメッセージをクリアする */
  clearSessionExpiredMessage: () => void;
  deleteAccount: () => Promise<void>;
  /** 現在のパスワードを確認した上で新しいパスワードに変更する */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** ユーザーのプロフィール情報を部分更新する */
  updateUserProfile: (patch: Partial<User>) => void;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  sessionExpiredMessage: null,
  hasAccount: false,

  /**
   * メールとパスワードでサインインする
   *
   * @param params - メールアドレスとパスワード
   * @throws Error - 認証失敗時
   */
  signIn: async (params: SignInParams) => {
    const data = await apiFetch<SignInResponse | AuthErrorResponse>("/api/auth/sign-in", {
      method: "POST",
      body: JSON.stringify(params),
    });

    if (!data.success) {
      throw new Error(data.error.message);
    }

    await setAuthToken(data.data.session.token);
    await setRefreshToken(data.data.session.refreshToken);

    await SecureStore.setItemAsync(HAS_ACCOUNT_KEY, JSON.stringify(true));
    set({
      user: data.data.user,
      session: data.data.session,
      isAuthenticated: true,
      hasAccount: true,
    });
  },

  /**
   * メール・パスワード・名前で新規アカウントを作成してサインインする
   *
   * @param params - 名前、メールアドレス、パスワード
   * @throws Error - 登録失敗時
   */
  signUp: async (params: SignUpParams) => {
    // Better Auth の sign-up/email は raw response を返す:
    // 成功時: { token: string | null, user: {...}, session?: {...} }
    // 失敗時: 4xx で apiFetch が ApiHttpError を throw
    type BetterAuthSignUpResponse = {
      token: string | null;
      user: User;
      session?: { token: string; refreshToken: string; expiresAt: string };
    };
    const data = await apiFetch<BetterAuthSignUpResponse>("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify(params),
    });

    if (!data.user) {
      throw new Error("登録に失敗しました。");
    }

    // requireEmailVerification=true で session が返らない場合、
    // 直ちに signIn を試みる（+maestro@ test users は emailVerified=true 自動設定されているので成功、
    // それ以外は EMAIL_NOT_VERIFIED エラーが throw されて UI に表示される）
    if (!data.session) {
      await get().signIn({ email: params.email, password: params.password });
      return;
    }

    await setAuthToken(data.session.token);
    await setRefreshToken(data.session.refreshToken);

    await SecureStore.setItemAsync(HAS_ACCOUNT_KEY, JSON.stringify(true));
    set({
      user: data.user,
      session: data.session,
      isAuthenticated: true,
      hasAccount: true,
    });
  },

  /**
   * サインアウトする
   * サーバー側のセッションを失効させた後、ローカルのトークンとストア状態をクリアする
   * サーバー到達不能・APIエラー時もローカルは必ずクリアされる
   */
  signOut: async () => {
    try {
      await apiFetch<{ success: true; data: null }>("/api/auth/sign-out", {
        method: "POST",
      });
    } catch {
      // サーバー失効に失敗してもローカルは必ずクリアする
    }

    await clearAuthTokens();

    set({
      user: null,
      session: null,
      isAuthenticated: false,
    });
  },

  /**
   * アカウントを削除する
   * サーバー側のユーザーデータを全削除後、ローカル状態をクリアする
   */
  deleteAccount: async () => {
    await apiFetch<{ success: true; data: null }>("/api/users/me", {
      method: "DELETE",
    });

    await clearAuthTokens();

    set({
      user: null,
      session: null,
      isAuthenticated: false,
    });
  },

  /**
   * パスワードを変更する
   *
   * @param currentPassword - 現在のパスワード
   * @param newPassword - 新しいパスワード
   * @throws Error - 現在のパスワードが不正または変更失敗時
   */
  changePassword: async (currentPassword: string, newPassword: string) => {
    const data = await apiFetch<{ success: boolean } | AuthErrorResponse>(
      "/api/users/me/password",
      {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    );

    if (!data.success) {
      throw new Error((data as AuthErrorResponse).error.message);
    }
  },

  /**
   * 保存済みトークンでセッションを復元する
   * アプリ起動時に呼び出す
   */
  checkSession: async () => {
    set({ isLoading: true, sessionExpiredMessage: null });

    const token = await getAuthToken();

    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const data = await apiFetch<
        { success: true; data: { user: User; session: Session } } | AuthErrorResponse
      >("/api/auth/session");

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

  /**
   * ユーザーのプロフィール情報を部分更新する
   * プロフィール保存成功時にストアを最新状態に保つ
   *
   * @param patch - 更新するフィールド
   */
  updateUserProfile: (patch: Partial<User>) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...patch } : state.user,
    }));
  },

  /**
   * SecureStoreからhasAccountフラグを読み込む
   * アプリ起動時に呼び出す
   */
  loadAccountFlag: async () => {
    const stored = await SecureStore.getItemAsync(HAS_ACCOUNT_KEY);
    const hasAccount = stored !== null ? (JSON.parse(stored) as boolean) : false;
    set({ hasAccount });
  },
}));
