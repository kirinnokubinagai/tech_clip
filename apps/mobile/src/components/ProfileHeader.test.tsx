import { fireEvent, render } from "@testing-library/react-native";

import { ProfileHeader } from "./ProfileHeader";
import type { ProfileHeaderUser } from "./ProfileHeader";

describe("ProfileHeader", () => {
  const baseUser: ProfileHeaderUser = {
    name: "テストユーザー",
    bio: "フロントエンドエンジニア。React Nativeが好き。",
    avatarUrl: null,
    followersCount: 128,
    followingCount: 64,
  };

  describe("表示", () => {
    it("ユーザー名が表示されること", async () => {
      // Arrange
      const user = { ...baseUser };

      // Act
      const { getByTestId } = await render(<ProfileHeader user={user} />);

      // Assert
      const name = getByTestId("profile-name");
      expect(name.props.children).toBe("テストユーザー");
    });

    it("bioが表示されること", async () => {
      // Arrange
      const user = { ...baseUser };

      // Act
      const { getByTestId } = await render(<ProfileHeader user={user} />);

      // Assert
      const bio = getByTestId("profile-bio");
      expect(bio).toBeDefined();
    });

    it("bioがnullの場合は非表示になること", async () => {
      // Arrange
      const user = { ...baseUser, bio: null };

      // Act
      const { queryByTestId } = await render(<ProfileHeader user={user} />);

      // Assert
      expect(queryByTestId("profile-bio")).toBeNull();
    });

    it("アバターURLがnullの場合はフォールバックが表示されること", async () => {
      // Arrange
      const user = { ...baseUser, avatarUrl: null };

      // Act
      const { getByTestId, queryByTestId } = await render(<ProfileHeader user={user} />);

      // Assert
      expect(getByTestId("profile-avatar-fallback")).toBeDefined();
      expect(queryByTestId("profile-avatar-image")).toBeNull();
    });

    it("フォロワー数が表示されること", async () => {
      // Arrange
      const user = { ...baseUser };

      // Act
      const { getByTestId } = await render(<ProfileHeader user={user} />);

      // Assert
      const count = getByTestId("profile-followers-count");
      expect(count.props.children).toBe("128");
    });

    it("フォロー中数が表示されること", async () => {
      // Arrange
      const user = { ...baseUser };

      // Act
      const { getByTestId } = await render(<ProfileHeader user={user} />);

      // Assert
      const count = getByTestId("profile-following-count");
      expect(count.props.children).toBe("64");
    });
  });

  describe("フォーマット", () => {
    it("1000以上の数値がK表記になること", async () => {
      // Arrange
      const user = { ...baseUser, followersCount: 1500 };

      // Act
      const { getByTestId } = await render(<ProfileHeader user={user} />);

      // Assert
      const count = getByTestId("profile-followers-count");
      expect(count.props.children).toBe("1.5K");
    });

    it("10000以上の数値が万表記になること", async () => {
      // Arrange
      const user = { ...baseUser, followersCount: 25000 };

      // Act
      const { getByTestId } = await render(<ProfileHeader user={user} />);

      // Assert
      const count = getByTestId("profile-followers-count");
      expect(count.props.children).toBe("2.5万");
    });

    it("1000未満の数値がそのまま表示されること", async () => {
      // Arrange
      const user = { ...baseUser, followersCount: 42 };

      // Act
      const { getByTestId } = await render(<ProfileHeader user={user} />);

      // Assert
      const count = getByTestId("profile-followers-count");
      expect(count.props.children).toBe("42");
    });
  });

  describe("インタラクション", () => {
    it("設定ボタンをタップするとonSettingsPressが呼ばれること", async () => {
      // Arrange
      const onSettingsPress = jest.fn();

      // Act
      const { getByTestId } = await render(
        <ProfileHeader user={baseUser} onSettingsPress={onSettingsPress} />,
      );
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(onSettingsPress).toHaveBeenCalledTimes(1);
    });

    it("onSettingsPressが未指定の場合は設定ボタンが非表示になること", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(<ProfileHeader user={baseUser} />);

      // Assert
      expect(queryByTestId("profile-settings-button")).toBeNull();
    });
  });
});
