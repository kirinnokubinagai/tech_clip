import ProfileScreen from "@mobile-app/(tabs)/profile";
import { fireEvent, render } from "@testing-library/react-native";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProfileScreen", () => {
  describe("画面表示", () => {
    it("プロフィール画面が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      expect(getByTestId("profile-header")).not.toBeNull();
    });

    it("プロフィールヘッダーにゲストユーザー名が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      expect(getByTestId("profile-name")).not.toBeNull();
    });

    it("設定ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      expect(getByTestId("profile-settings-button")).not.toBeNull();
    });
  });

  describe("ナビゲーション", () => {
    it("設定ボタンをタップすると設定画面に遷移すること", async () => {
      // Arrange
      const { getByTestId } = await render(<ProfileScreen />);

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/(tabs)/settings");
    });
  });
});
