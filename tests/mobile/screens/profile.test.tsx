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
  describe("初期表示", () => {
    it("プレースホルダーユーザーで ProfileHeader が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      expect(getByTestId("profile-header")).toBeDefined();
    });

    it("プレースホルダーユーザー名が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      const nameEl = getByTestId("profile-name");
      expect(nameEl).toBeDefined();
    });

    it("ログイン誘導テキストが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<ProfileScreen />);

      // Assert
      expect(getByText("ログインすると保存した記事やお気に入りが表示されます")).toBeDefined();
    });
  });

  describe("設定ボタン", () => {
    it("設定ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert
      expect(getByTestId("profile-settings-button")).toBeDefined();
    });

    it("設定ボタン押下で /(tabs)/settings に遷移すること", async () => {
      // Arrange
      const { getByTestId } = await render(<ProfileScreen />);

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/(tabs)/settings");
    });

    it("設定ボタン押下後に router.push が1度だけ呼ばれること", async () => {
      // Arrange
      const { getByTestId } = await render(<ProfileScreen />);

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });
});
