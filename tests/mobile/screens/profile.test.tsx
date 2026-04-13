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

  describe("境界値", () => {
    it("フォロワー数とフォロー中数が0の場合でも画面が表示されること", async () => {
      // Arrange: プレースホルダーユーザーはフォロワー数0・フォロー中数0で初期化される（境界値）
      // Act
      const { getByTestId } = await render(<ProfileScreen />);

      // Assert: カウントが0でもクラッシュせず表示される
      const followersCount = getByTestId("profile-followers-count");
      const followingCount = getByTestId("profile-following-count");
      expect(followersCount.props.children).toBe("0");
      expect(followingCount.props.children).toBe("0");
    });
  });
});
