jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
  SessionExpiredError: class SessionExpiredError extends Error {
    constructor() {
      super("セッションの有効期限が切れました。再度ログインしてください。");
      this.name = "SessionExpiredError";
    }
  },
}));

jest.mock("@/lib/secure-store", () => ({
  getAuthToken: jest.fn(),
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
  clearAuthTokens: jest.fn(),
}));

import { useAuthStore } from "@mobile/stores/auth-store";

import { apiFetch, SessionExpiredError } from "@/lib/api";
import { clearAuthTokens, getAuthToken, setAuthToken, setRefreshToken } from "@/lib/secure-store";

/** モック型キャスト */
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>;
const mockSetAuthToken = setAuthToken as jest.MockedFunction<typeof setAuthToken>;
const mockSetRefreshToken = setRefreshToken as jest.MockedFunction<typeof setRefreshToken>;
const mockClearAuthTokens = clearAuthTokens as jest.MockedFunction<typeof clearAuthTokens>;

/** テスト用ユーザーデータ */
const TEST_USER = {
  id: "user-1",
  email: "test@example.com",
  name: "テストユーザー",
  image: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

/** テスト用セッションデータ（accessToken と refreshToken が別々） */
const TEST_SESSION = {
  token: "test-access-token",
  refreshToken: "test-session-id-as-refresh-token",
  expiresAt: "2024-12-31T00:00:00Z",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,
      sessionExpiredMessage: null,
      hasAccount: false,
    });
    mockSetAuthToken.mockResolvedValue(undefined);
    mockSetRefreshToken.mockResolvedValue(undefined);
    mockClearAuthTokens.mockResolvedValue(undefined);
  });

  describe("signIn", () => {
    it("有効な認証情報でサインインできること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        success: true,
        data: { user: TEST_USER, session: TEST_SESSION },
      });

      // Act
      await useAuthStore.getState().signIn({ email: "test@example.com", password: "Password123" });

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(TEST_USER);
      expect(state.session).toEqual(TEST_SESSION);
      expect(mockSetAuthToken).toHaveBeenCalledWith(TEST_SESSION.token);
      expect(mockSetRefreshToken).toHaveBeenCalledWith(TEST_SESSION.refreshToken);
    });

    it("サインイン時にaccessTokenとrefreshTokenを別々に保存すること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        success: true,
        data: { user: TEST_USER, session: TEST_SESSION },
      });

      // Act
      await useAuthStore.getState().signIn({ email: "test@example.com", password: "Password123" });

      // Assert
      expect(mockSetAuthToken).toHaveBeenCalledWith("test-access-token");
      expect(mockSetRefreshToken).toHaveBeenCalledWith("test-session-id-as-refresh-token");
      expect(mockSetAuthToken).not.toHaveBeenCalledWith("test-session-id-as-refresh-token");
      expect(mockSetRefreshToken).not.toHaveBeenCalledWith("test-access-token");
    });

    it("認証失敗時にエラーをスローすること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        success: false,
        error: { code: "AUTH_INVALID", message: "認証情報が正しくありません。" },
      });

      // Act & Assert
      await expect(
        useAuthStore.getState().signIn({ email: "wrong@example.com", password: "wrong" }),
      ).rejects.toThrow("認証情報が正しくありません。");

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe("signUp", () => {
    it("有効なデータで新規登録できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        token: TEST_SESSION.token,
        user: TEST_USER,
        session: TEST_SESSION,
      });

      // Act
      await useAuthStore.getState().signUp({
        name: "テストユーザー",
        email: "test@example.com",
        password: "Password123",
      });

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(mockSetAuthToken).toHaveBeenCalledWith(TEST_SESSION.token);
      expect(mockSetRefreshToken).toHaveBeenCalledWith(TEST_SESSION.refreshToken);
    });

    it("新規登録時にaccessTokenとrefreshTokenを別々に保存すること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        token: TEST_SESSION.token,
        user: TEST_USER,
        session: TEST_SESSION,
      });

      // Act
      await useAuthStore.getState().signUp({
        name: "テストユーザー",
        email: "test@example.com",
        password: "Password123",
      });

      // Assert
      expect(mockSetAuthToken).toHaveBeenCalledWith("test-access-token");
      expect(mockSetRefreshToken).toHaveBeenCalledWith("test-session-id-as-refresh-token");
      expect(mockSetAuthToken).not.toHaveBeenCalledWith("test-session-id-as-refresh-token");
      expect(mockSetRefreshToken).not.toHaveBeenCalledWith("test-access-token");
    });
  });

  describe("signOut", () => {
    it("サインアウト後にstateがクリアされること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true, data: null });
      useAuthStore.setState({ user: TEST_USER, session: TEST_SESSION, isAuthenticated: true });

      // Act
      await useAuthStore.getState().signOut();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("/api/auth/sign-out エンドポイントをPOSTで呼ぶこと", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true, data: null });
      useAuthStore.setState({ user: TEST_USER, session: TEST_SESSION, isAuthenticated: true });

      // Act
      await useAuthStore.getState().signOut();

      // Assert
      expect(mockApiFetch).toHaveBeenCalledWith("/api/auth/sign-out", { method: "POST" });
    });

    it("API失敗時もローカルのclearAuthTokensが呼ばれてstateがクリアされること", async () => {
      // Arrange
      mockApiFetch.mockRejectedValue(new Error("ネットワークエラー"));
      useAuthStore.setState({ user: TEST_USER, session: TEST_SESSION, isAuthenticated: true });

      // Act
      await useAuthStore.getState().signOut();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("SessionExpiredErrorが発生した場合もローカルクリアされること", async () => {
      // Arrange
      mockApiFetch.mockRejectedValue(new SessionExpiredError());
      useAuthStore.setState({ user: TEST_USER, session: TEST_SESSION, isAuthenticated: true });

      // Act
      await useAuthStore.getState().signOut();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe("checkSession", () => {
    it("有効なトークンがある場合にセッションを復元できること", async () => {
      // Arrange
      mockGetAuthToken.mockResolvedValue("valid-token");
      mockApiFetch.mockResolvedValue({
        success: true,
        data: { user: TEST_USER, session: TEST_SESSION },
      });

      // Act
      await useAuthStore.getState().checkSession();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(TEST_USER);
      expect(state.isLoading).toBe(false);
    });

    it("トークンがない場合は未認証状態になること", async () => {
      // Arrange
      mockGetAuthToken.mockResolvedValue(null);

      // Act
      await useAuthStore.getState().checkSession();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("セッション期限切れハンドリング", () => {
    it("初期状態でsessionExpiredMessageがnullであること", async () => {
      // Arrange & Act
      const state = useAuthStore.getState();

      // Assert
      expect(state.sessionExpiredMessage).toBeNull();
    });

    it("handleSessionExpiredを呼ぶと認証状態がクリアされsessionExpiredMessageが設定されること", async () => {
      // Arrange
      useAuthStore.setState({ user: TEST_USER, session: TEST_SESSION, isAuthenticated: true });

      // Act
      await useAuthStore.getState().handleSessionExpired();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.sessionExpiredMessage).toBe(
        "セッションの有効期限が切れました。再度ログインしてください。",
      );
      expect(mockClearAuthTokens).toHaveBeenCalledTimes(1);
    });

    it("clearSessionExpiredMessageを呼ぶとsessionExpiredMessageがnullになること", async () => {
      // Arrange
      useAuthStore.setState({
        sessionExpiredMessage: "セッションの有効期限が切れました。再度ログインしてください。",
      });

      // Act
      useAuthStore.getState().clearSessionExpiredMessage();

      // Assert
      expect(useAuthStore.getState().sessionExpiredMessage).toBeNull();
    });

    it("checkSession時にSessionExpiredErrorがスローされた場合は未認証状態になること", async () => {
      // Arrange
      mockGetAuthToken.mockResolvedValue("expired-token");
      mockApiFetch.mockRejectedValue(new SessionExpiredError());

      // Act
      await useAuthStore.getState().checkSession();

      // Assert
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.sessionExpiredMessage).toBeNull();
    });
  });
});

describe("hasAccount フラグ", () => {
  it("初期状態でhasAccountがfalseであること", () => {
    // Arrange & Act
    const state = useAuthStore.getState();

    // Assert
    expect(state.hasAccount).toBe(false);
  });

  it("signIn成功後にhasAccountがtrueになること", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue({
      success: true,
      data: { user: TEST_USER, session: TEST_SESSION },
    });

    // Act
    await useAuthStore.getState().signIn({ email: "test@example.com", password: "Password123" });

    // Assert
    expect(useAuthStore.getState().hasAccount).toBe(true);
  });

  it("signUp成功後にhasAccountがtrueになること", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue({
      token: TEST_SESSION.token,
      user: TEST_USER,
      session: TEST_SESSION,
    });

    // Act
    await useAuthStore.getState().signUp({
      email: "test@example.com",
      password: "Password123",
      name: "テストユーザー",
    });

    // Assert
    expect(useAuthStore.getState().hasAccount).toBe(true);
  });

  it("signOut後もhasAccountがtrueのままであること", async () => {
    // Arrange
    useAuthStore.setState({ isAuthenticated: true, hasAccount: true });
    mockApiFetch.mockResolvedValue({ success: true, data: null });

    // Act
    await useAuthStore.getState().signOut();

    // Assert
    expect(useAuthStore.getState().hasAccount).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("loadAccountFlagでSecureStoreの値を読み込めること", async () => {
    // Arrange（SecureStoreに保存済みの想定）
    const mockGetItemAsync = jest.fn().mockResolvedValue(JSON.stringify(true));
    jest.spyOn(require("expo-secure-store"), "getItemAsync").mockImplementation(mockGetItemAsync);

    // Act
    await useAuthStore.getState().loadAccountFlag();

    // Assert
    expect(useAuthStore.getState().hasAccount).toBe(true);
  });
});

describe("signUp - メール確認必須時の自動サインイン", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,
      sessionExpiredMessage: null,
      hasAccount: false,
    });
    mockSetAuthToken.mockResolvedValue(undefined);
    mockSetRefreshToken.mockResolvedValue(undefined);
    mockClearAuthTokens.mockResolvedValue(undefined);
  });

  it("sign-up でtoken=nullの場合、自動的にsignInを呼び出して認証状態になること", async () => {
    // Arrange
    mockApiFetch
      .mockResolvedValueOnce({
        token: null,
        user: TEST_USER,
      })
      .mockResolvedValueOnce({
        success: true,
        data: { user: TEST_USER, session: TEST_SESSION },
      });

    // Act
    await useAuthStore.getState().signUp({
      name: "テストユーザー",
      email: "test+maestro@techclip.app",
      password: "Password123",
    });

    // Assert
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(TEST_USER);
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      2,
      "/api/auth/sign-in",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockSetAuthToken).toHaveBeenCalledWith(TEST_SESSION.token);
    expect(mockSetRefreshToken).toHaveBeenCalledWith(TEST_SESSION.refreshToken);
  });

  it("sign-up でtoken=nullかつsignInも失敗した場合、エラーをスローすること", async () => {
    // Arrange
    mockApiFetch
      .mockResolvedValueOnce({
        token: null,
        user: TEST_USER,
      })
      .mockResolvedValueOnce({
        success: false,
        error: { code: "EMAIL_NOT_VERIFIED", message: "メールアドレスが確認されていません" },
      });

    // Act & Assert
    await expect(
      useAuthStore.getState().signUp({
        name: "テストユーザー",
        email: "test@example.com",
        password: "Password123",
      }),
    ).rejects.toThrow("メールアドレスが確認されていません");

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
