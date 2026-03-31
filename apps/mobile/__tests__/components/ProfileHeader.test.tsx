import { fireEvent, render } from "@testing-library/react-native";

import { ProfileHeader } from "../../src/components/ProfileHeader";
import type { ProfileHeaderUser } from "../../src/components/ProfileHeader";

/** テスト用ユーザーデータ */
const BASE_USER: ProfileHeaderUser = {
  name: "テストユーザー",
  bio: "テストのbioです。",
  avatarUrl: null,
  followersCount: 100,
  followingCount: 50,
};

describe("ProfileHeader", () => {
  describe("レンダリング", () => {
    it("プロフィールヘッダーが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileHeader user={BASE_USER} />);

      // Assert
      expect(getByTestId("profile-header")).toBeDefined();
    });

    it("ユーザー名が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileHeader user={BASE_USER} />);

      // Assert
      const name = getByTestId("profile-name");
      expect(name.props.children).toBe("テストユーザー");
    });

    it("bioが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileHeader user={BASE_USER} />);

      // Assert
      const bio = getByTestId("profile-bio");
      expect(bio.props.children).toBe("テストのbioです。");
    });

    it("bioがnullの場合bioが表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(<ProfileHeader user={{ ...BASE_USER, bio: null }} />);

      // Assert
      expect(queryByTestId("profile-bio")).toBeNull();
    });
  });

  describe("アバター", () => {
    it("avatarUrlがnullの場合フォールバックが表示されること", async () => {
      // Arrange & Act
      const { getByTestId, queryByTestId } = await render(
        <ProfileHeader user={{ ...BASE_USER, avatarUrl: null }} />,
      );

      // Assert
      expect(getByTestId("profile-avatar-fallback")).toBeDefined();
      expect(queryByTestId("profile-avatar-image")).toBeNull();
    });

    it("avatarUrlが指定された場合画像が表示されること", async () => {
      // Arrange & Act
      const { getByTestId, queryByTestId } = await render(
        <ProfileHeader user={{ ...BASE_USER, avatarUrl: "https://example.com/avatar.png" }} />,
      );

      // Assert
      expect(getByTestId("profile-avatar-image")).toBeDefined();
      expect(queryByTestId("profile-avatar-fallback")).toBeNull();
    });

    it("フォールバック表示時に名前の頭文字が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <ProfileHeader user={{ ...BASE_USER, avatarUrl: null }} />,
      );

      // Assert
      expect(getByText("テス")).toBeTruthy();
    });
  });

  describe("フォロー統計", () => {
    it("フォロワー数が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileHeader user={BASE_USER} />);

      // Assert
      const count = getByTestId("profile-followers-count");
      expect(count.props.children).toBe("100");
    });

    it("フォロー中の数が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<ProfileHeader user={BASE_USER} />);

      // Assert
      const count = getByTestId("profile-following-count");
      expect(count.props.children).toBe("50");
    });

    it("1000以上の数値はK形式で表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ProfileHeader user={{ ...BASE_USER, followersCount: 1500 }} />,
      );

      // Assert
      const count = getByTestId("profile-followers-count");
      expect(count.props.children).toBe("1.5K");
    });

    it("10000以上の数値は万形式で表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ProfileHeader user={{ ...BASE_USER, followersCount: 15000 }} />,
      );

      // Assert
      const count = getByTestId("profile-followers-count");
      expect(count.props.children).toBe("1.5万");
    });
  });

  describe("設定ボタン", () => {
    it("onSettingsPressが未指定の場合設定ボタンが表示されないこと", async () => {
      // Arrange & Act
      const { queryByTestId } = await render(<ProfileHeader user={BASE_USER} />);

      // Assert
      expect(queryByTestId("profile-settings-button")).toBeNull();
    });

    it("onSettingsPressが指定された場合設定ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(
        <ProfileHeader user={BASE_USER} onSettingsPress={jest.fn()} />,
      );

      // Assert
      expect(getByTestId("profile-settings-button")).toBeDefined();
    });

    it("設定ボタンタップ時にonSettingsPressが呼ばれること", async () => {
      // Arrange
      const onSettingsPress = jest.fn();
      const { getByTestId } = await render(
        <ProfileHeader user={BASE_USER} onSettingsPress={onSettingsPress} />,
      );

      // Act
      await fireEvent.press(getByTestId("profile-settings-button"));

      // Assert
      expect(onSettingsPress).toHaveBeenCalledTimes(1);
    });
  });
});
