import ProfileScreen from "@mobile-app/(tabs)/profile";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCheckSession = jest.fn().mockResolvedValue(undefined);

jest.mock("@mobile/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      checkSession: mockCheckSession,
    }),
  ),
}));

jest.mock("@mobile/hooks/use-my-profile", () => ({
  useMyProfile: jest.fn(() => ({ data: undefined, isLoading: false })),
}));

const { useAuthStore } = jest.requireMock("@mobile/stores/auth-store") as {
  useAuthStore: jest.Mock;
};

const { useMyProfile } = jest.requireMock("@mobile/hooks/use-my-profile") as {
  useMyProfile: jest.Mock;
};

/** テスト用ユーザーオブジェクト */
const MOCK_USER = {
  id: "user_01",
  name: "テストユーザー",
  email: "test@example.com",
  image: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

/**
 * 未ログイン状態をモックする
 */
function mockGuestState() {
  useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      checkSession: mockCheckSession,
    }),
  );
}

/**
 * ログイン済み状態をモックする
 */
function mockAuthenticatedState(overrides: Partial<typeof MOCK_USER> = {}) {
  useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: { ...MOCK_USER, ...overrides },
      isAuthenticated: true,
      isLoading: false,
      checkSession: mockCheckSession,
    }),
  );
}

/**
 * ローディング状態をモックする
 */
function mockLoadingState() {
  useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      checkSession: mockCheckSession,
    }),
  );
}

/** APIプロフィールデータ */
const MOCK_PROFILE = {
  id: "user_01",
  email: "test@example.com",
  name: "テストユーザー",
  image: null,
  avatarUrl: null,
  username: "test_user",
  bio: "テストのbioです",
  websiteUrl: null,
  githubUsername: null,
  twitterUsername: null,
  isProfilePublic: true,
  preferredLanguage: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

// NOTE: @testing-library/react-native v13+ では render() が Promise を返す
describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    mockCheckSession.mockResolvedValue(undefined);
    useMyProfile.mockReturnValue({ data: undefined, isLoading: false });
  });
  describe("未ログイン時", () => {
    it("ログイン誘導メッセージが表示されること", async () => {
      // Arrange
      mockGuestState();

      // Act
      const { queryByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-guest-message")).not.toBeNull();
      });
    });

    it("ログインボタンが表示されること", async () => {
      // Arrange
      mockGuestState();

      // Act
      const { queryByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-login-button")).not.toBeNull();
      });
    });

    it("ログインボタンを押すとログイン画面に遷移すること", async () => {
      // Arrange
      mockGuestState();
      const { getByTestId } = await render(<ProfileScreen />);
      const loginButton = getByTestId("profile-login-button");

      // Act
      fireEvent.press(loginButton);

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/(auth)/login");
    });

    it("ProfileHeaderがゲスト固定表示されないこと", async () => {
      // Arrange
      mockGuestState();

      // Act
      const { queryByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-header")).toBeNull();
      });
    });
  });

  describe("ローディング中", () => {
    it("ローディングインジケータが表示されること", async () => {
      // Arrange
      mockLoadingState();

      // Act
      const { queryByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-loading")).not.toBeNull();
      });
    });
  });

  describe("ログイン済み", () => {
    it("ProfileHeaderにユーザー名が表示されること", async () => {
      // Arrange
      mockAuthenticatedState();
      useMyProfile.mockReturnValue({ data: MOCK_PROFILE, isLoading: false });

      // Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        const nameEl = getByTestId("profile-name");
        expect(nameEl.props.children).toBe("テストユーザー");
      });
    });

    it("APIから取得したbioが表示されること", async () => {
      // Arrange
      mockAuthenticatedState();
      useMyProfile.mockReturnValue({ data: MOCK_PROFILE, isLoading: false });

      // Act
      const { queryByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-bio")).not.toBeNull();
      });
    });

    it("ProfileHeaderにアバターが表示されること（avatarUrl がある場合）", async () => {
      // Arrange
      mockAuthenticatedState({ image: "https://example.com/avatar.png" });
      useMyProfile.mockReturnValue({
        data: { ...MOCK_PROFILE, avatarUrl: "https://example.com/avatar.png" },
        isLoading: false,
      });

      // Act
      const { queryByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-avatar-image")).not.toBeNull();
      });
    });

    it("avatarUrl がない場合はフォールバックアバターが表示されること", async () => {
      // Arrange
      mockAuthenticatedState();
      useMyProfile.mockReturnValue({ data: MOCK_PROFILE, isLoading: false });

      // Act
      const { queryByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-avatar-fallback")).not.toBeNull();
      });
    });

    it("プロフィールローディング中はローディングインジケータが表示されること", async () => {
      // Arrange
      mockAuthenticatedState();
      useMyProfile.mockReturnValue({ data: undefined, isLoading: true });

      // Act
      const { queryByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-loading")).not.toBeNull();
      });
    });

    it("設定ボタンを押すと設定画面に遷移すること", async () => {
      // Arrange
      mockAuthenticatedState();
      useMyProfile.mockReturnValue({ data: MOCK_PROFILE, isLoading: false });
      const { getByTestId } = await render(<ProfileScreen />);

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/(tabs)/settings");
    });

    it("設定ボタン押下後に router.push が1度だけ呼ばれること", async () => {
      // Arrange
      mockAuthenticatedState();
      useMyProfile.mockReturnValue({ data: MOCK_PROFILE, isLoading: false });
      const { getByTestId } = await render(<ProfileScreen />);

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });
});
