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

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockReset();
  mockCheckSession.mockResolvedValue(undefined);
});

describe("ProfileScreen", () => {
  describe("未ログイン時", () => {
    it("ログイン誘導メッセージが表示されること", async () => {
      // Arrange
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          checkSession: mockCheckSession,
        }),
      );

      // Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("profile-guest-message")).toBeDefined();
      });
    });

    it("ログインボタンが表示されること", async () => {
      // Arrange
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          checkSession: mockCheckSession,
        }),
      );

      // Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("profile-login-button")).toBeDefined();
      });
    });

    it("ログインボタンを押すとログイン画面に遷移すること", async () => {
      // Arrange
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          checkSession: mockCheckSession,
        }),
      );
      const { getByTestId } = await render(<ProfileScreen />);
      const loginButton = getByTestId("profile-login-button");

      // Act
      fireEvent.press(loginButton);

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/(auth)/login");
    });

    it("ProfileHeaderがゲスト固定表示されないこと", async () => {
      // Arrange
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          checkSession: mockCheckSession,
        }),
      );

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
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: null,
          isAuthenticated: false,
          isLoading: true,
          checkSession: mockCheckSession,
        }),
      );

      // Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("profile-loading")).toBeDefined();
      });
    });
  });

  describe("ログイン済み", () => {
    it("ProfileHeaderにユーザー名が表示されること", async () => {
      // Arrange
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: {
            id: "user_01",
            name: "テストユーザー",
            email: "test@example.com",
            image: null,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          isAuthenticated: true,
          isLoading: false,
          checkSession: mockCheckSession,
        }),
      );

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
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: {
            id: "user_01",
            name: "テストユーザー",
            email: "test@example.com",
            image: "https://example.com/avatar.png",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          isAuthenticated: true,
          isLoading: false,
          checkSession: mockCheckSession,
        }),
      );

      // Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("profile-avatar-image")).toBeDefined();
      });
    });

    it("avatarUrl がない場合はフォールバックアバターが表示されること", async () => {
      // Arrange
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: {
            id: "user_01",
            name: "テストユーザー",
            email: "test@example.com",
            image: null,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          isAuthenticated: true,
          isLoading: false,
          checkSession: mockCheckSession,
        }),
      );

      // Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("profile-avatar-fallback")).toBeDefined();
      });
    });

    it("設定ボタンを押すと設定画面に遷移すること", async () => {
      // Arrange
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: {
            id: "user_01",
            name: "テストユーザー",
            email: "test@example.com",
            image: null,
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          isAuthenticated: true,
          isLoading: false,
          checkSession: mockCheckSession,
        }),
      );
      const { getByTestId } = await render(<ProfileScreen />);

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/(tabs)/settings");
    });
  });
});
