import ProfileScreen from "@mobile-app/(tabs)/profile";
import { render, waitFor } from "@testing-library/react-native";

/** 認証済みユーザーデータ */
const MOCK_AUTHENTICATED_USER = {
  id: "user-1",
  email: "test@example.com",
  name: "テストユーザー",
  image: "https://example.com/avatar.jpg",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock("@/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: MOCK_AUTHENTICATED_USER,
      isAuthenticated: true,
      isLoading: false,
    }),
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  const { useAuthStore } = jest.requireMock("@/stores/auth-store") as {
    useAuthStore: jest.Mock;
  };
  useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: MOCK_AUTHENTICATED_USER,
      isAuthenticated: true,
      isLoading: false,
    }),
  );
});

describe("ProfileScreen", () => {
  describe("認証済み状態", () => {
    it("認証済みユーザーの名前が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        const name = getByTestId("profile-name");
        expect(name.props.children).toBe("テストユーザー");
      });
    });

    it("設定ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("profile-settings-button")).toBeDefined();
      });
    });
  });

  describe("ローディング状態", () => {
    it("isLoading中はローディング表示になること", async () => {
      // Arrange
      const { useAuthStore } = jest.requireMock("@/stores/auth-store") as {
        useAuthStore: jest.Mock;
      };
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: null,
          isAuthenticated: false,
          isLoading: true,
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

  describe("未認証状態", () => {
    it("未認証かつローディング完了時にゲスト表示になること", async () => {
      // Arrange
      const { useAuthStore } = jest.requireMock("@/stores/auth-store") as {
        useAuthStore: jest.Mock;
      };
      useAuthStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
        selector({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
      );

      // Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("profile-guest")).toBeDefined();
      });
    });
  });
});
