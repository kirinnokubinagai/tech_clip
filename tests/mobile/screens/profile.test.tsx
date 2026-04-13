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

const { useAuthStore } = jest.requireMock("@mobile/stores/auth-store") as {
  useAuthStore: jest.Mock;
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

describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    mockCheckSession.mockResolvedValue(undefined);
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
      mockAuthenticatedState({ image: "https://example.com/avatar.png" });

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
      const { getByTestId } = await render(<ProfileScreen />);

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/(tabs)/settings");
    });
  });
});
