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
      isAuthenticated: false,
      isLoading: false,
      checkSession: mockCheckSession,
    }),
  ),
}));

const { useAuthStore } = jest.requireMock("@mobile/stores/auth-store") as {
  useAuthStore: jest.Mock;
};

const mockUseMyProfile = jest.fn();

jest.mock("@mobile/hooks/use-my-profile", () => ({
  useMyProfile: () => mockUseMyProfile(),
}));

jest.mock("@mobile/components/ProfileArticlesSection", () => ({
  ProfileArticlesSection: () => null,
}));

/** テスト用プロフィールデータ */
const MOCK_ME_PROFILE = {
  id: "user_01",
  name: "テストユーザー",
  username: null,
  bio: null,
  avatarUrl: null,
  followersCount: 0,
  followingCount: 0,
};

/**
 * 未ログイン状態をモックする
 */
function mockGuestState() {
  useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      isAuthenticated: false,
      isLoading: false,
      checkSession: mockCheckSession,
    }),
  );
}

/**
 * ログイン済み状態をモックする
 */
function mockAuthenticatedState() {
  useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      isAuthenticated: true,
      isLoading: false,
      checkSession: mockCheckSession,
    }),
  );
}

/**
 * 認証ローディング状態をモックする
 */
function mockLoadingState() {
  useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      isAuthenticated: false,
      isLoading: true,
      checkSession: mockCheckSession,
    }),
  );
}

// NOTE: @testing-library/react-native v13+ では render() が Promise を返す
describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    mockCheckSession.mockResolvedValue(undefined);
    mockUseMyProfile.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });
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
      mockUseMyProfile.mockReturnValue({
        data: MOCK_ME_PROFILE,
        isLoading: false,
        isError: false,
      });

      // Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        const nameEl = getByTestId("profile-name");
        expect(nameEl.props.children).toBe("テストユーザー");
      });
    });

    it("ProfileHeaderにアバターが表示されること（avatarUrl がある場合）", async () => {
      // Arrange
      mockAuthenticatedState();
      mockUseMyProfile.mockReturnValue({
        data: { ...MOCK_ME_PROFILE, avatarUrl: "https://example.com/avatar.png" },
        isLoading: false,
        isError: false,
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
      mockUseMyProfile.mockReturnValue({
        data: MOCK_ME_PROFILE,
        isLoading: false,
        isError: false,
      });

      // Act
      const { queryByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(queryByTestId("profile-avatar-fallback")).not.toBeNull();
      });
    });

    it("設定ボタンを押すと設定画面に遷移すること", async () => {
      // Arrange
      mockAuthenticatedState();
      mockUseMyProfile.mockReturnValue({
        data: MOCK_ME_PROFILE,
        isLoading: false,
        isError: false,
      });
      const { getByTestId } = await render(<ProfileScreen />);

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/(tabs)/settings");
    });

    it("設定ボタン押下後に router.push が1度だけ呼ばれること", async () => {
      // Arrange
      mockAuthenticatedState();
      mockUseMyProfile.mockReturnValue({
        data: MOCK_ME_PROFILE,
        isLoading: false,
        isError: false,
      });
      const { getByTestId } = await render(<ProfileScreen />);

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });
});
