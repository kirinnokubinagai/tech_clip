import { fireEvent, render, screen } from "@testing-library/react-native";
import { ProfileHeader } from "../ProfileHeader";
import type { ProfileHeaderUser } from "../ProfileHeader";

describe("ProfileHeader", () => {
  const baseUser: ProfileHeaderUser = {
    name: "テストユーザー",
    bio: "フロントエンドエンジニア。React Nativeが好き。",
    avatarUrl: "https://example.com/avatar.png",
    followersCount: 128,
    followingCount: 64,
  };

  describe("表示", () => {
    it("ユーザー名が表示されること", () => {
      // Arrange
      const user = { ...baseUser };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.getByTestId("profile-name")).toHaveTextContent("テストユーザー");
    });

    it("bioが表示されること", () => {
      // Arrange
      const user = { ...baseUser };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.getByTestId("profile-bio")).toHaveTextContent(
        "フロントエンドエンジニア。React Nativeが好き。",
      );
    });

    it("bioがnullの場合は非表示になること", () => {
      // Arrange
      const user = { ...baseUser, bio: null };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.queryByTestId("profile-bio")).toBeNull();
    });

    it("アバター画像が表示されること", () => {
      // Arrange
      const user = { ...baseUser };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.getByTestId("profile-avatar-image")).toBeTruthy();
    });

    it("アバターURLがnullの場合はフォールバックが表示されること", () => {
      // Arrange
      const user = { ...baseUser, avatarUrl: null };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.getByTestId("profile-avatar-fallback")).toBeTruthy();
      expect(screen.queryByTestId("profile-avatar-image")).toBeNull();
    });

    it("フォロワー数が表示されること", () => {
      // Arrange
      const user = { ...baseUser };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("128");
    });

    it("フォロー中数が表示されること", () => {
      // Arrange
      const user = { ...baseUser };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.getByTestId("profile-following-count")).toHaveTextContent("64");
    });
  });

  describe("フォーマット", () => {
    it("1000以上の数値がK表記になること", () => {
      // Arrange
      const user = { ...baseUser, followersCount: 1500 };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("1.5K");
    });

    it("10000以上の数値が万表記になること", () => {
      // Arrange
      const user = { ...baseUser, followersCount: 25000 };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("2.5万");
    });

    it("1000未満の数値がそのまま表示されること", () => {
      // Arrange
      const user = { ...baseUser, followersCount: 42 };

      // Act
      render(<ProfileHeader user={user} />);

      // Assert
      expect(screen.getByTestId("profile-followers-count")).toHaveTextContent("42");
    });
  });

  describe("インタラクション", () => {
    it("設定ボタンをタップするとonSettingsPressが呼ばれること", () => {
      // Arrange
      const onSettingsPress = jest.fn();

      // Act
      render(<ProfileHeader user={baseUser} onSettingsPress={onSettingsPress} />);
      fireEvent.press(screen.getByTestId("profile-settings-button"));

      // Assert
      expect(onSettingsPress).toHaveBeenCalledTimes(1);
    });

    it("onSettingsPressが未指定の場合は設定ボタンが非表示になること", () => {
      // Arrange & Act
      render(<ProfileHeader user={baseUser} />);

      // Assert
      expect(screen.queryByTestId("profile-settings-button")).toBeNull();
    });
  });
});
