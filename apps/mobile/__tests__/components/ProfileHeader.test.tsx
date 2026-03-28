import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

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

/**
 * testIDでReactTestInstanceを検索するヘルパー
 */
function findByTestId(root: ReactTestInstance, testId: string): ReactTestInstance {
  return root.findByProps({ testID: testId });
}

function queryByTestId(root: ReactTestInstance, testId: string): ReactTestInstance | null {
  const results = root.findAllByProps({ testID: testId });
  return results.length > 0 ? results[0] : null;
}

describe("ProfileHeader", () => {
  describe("レンダリング", () => {
    it("プロフィールヘッダーが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ProfileHeader user={BASE_USER} />);

      // Assert
      expect(findByTestId(UNSAFE_root, "profile-header")).toBeDefined();
    });

    it("ユーザー名が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ProfileHeader user={BASE_USER} />);

      // Assert
      const name = findByTestId(UNSAFE_root, "profile-name");
      expect(name.props.children).toBe("テストユーザー");
    });

    it("bioが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ProfileHeader user={BASE_USER} />);

      // Assert
      const bio = findByTestId(UNSAFE_root, "profile-bio");
      expect(bio.props.children).toBe("テストのbioです。");
    });

    it("bioがnullの場合bioが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ProfileHeader user={{ ...BASE_USER, bio: null }} />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "profile-bio")).toBeNull();
    });
  });

  describe("アバター", () => {
    it("avatarUrlがnullの場合フォールバックが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ProfileHeader user={{ ...BASE_USER, avatarUrl: null }} />);

      // Assert
      expect(findByTestId(UNSAFE_root, "profile-avatar-fallback")).toBeDefined();
      expect(queryByTestId(UNSAFE_root, "profile-avatar-image")).toBeNull();
    });

    it("avatarUrlが指定された場合画像が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ProfileHeader user={{ ...BASE_USER, avatarUrl: "https://example.com/avatar.png" }} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "profile-avatar-image")).toBeDefined();
      expect(queryByTestId(UNSAFE_root, "profile-avatar-fallback")).toBeNull();
    });

    it("フォールバック表示時に名前の頭文字が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_getAllByType } = render(
        <ProfileHeader user={{ ...BASE_USER, avatarUrl: null }} />,
      );
      const texts = UNSAFE_getAllByType(Text).map((n) => n.props.children);

      // Assert（"テス" = 最初の2文字が頭文字として表示される）
      expect(texts).toContain("テス");
    });
  });

  describe("フォロー統計", () => {
    it("フォロワー数が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ProfileHeader user={BASE_USER} />);

      // Assert
      const count = findByTestId(UNSAFE_root, "profile-followers-count");
      expect(count.props.children).toBe("100");
    });

    it("フォロー中の数が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ProfileHeader user={BASE_USER} />);

      // Assert
      const count = findByTestId(UNSAFE_root, "profile-following-count");
      expect(count.props.children).toBe("50");
    });

    it("1000以上の数値はK形式で表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ProfileHeader user={{ ...BASE_USER, followersCount: 1500 }} />,
      );

      // Assert
      const count = findByTestId(UNSAFE_root, "profile-followers-count");
      expect(count.props.children).toBe("1.5K");
    });

    it("10000以上の数値は万形式で表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ProfileHeader user={{ ...BASE_USER, followersCount: 15000 }} />,
      );

      // Assert
      const count = findByTestId(UNSAFE_root, "profile-followers-count");
      expect(count.props.children).toBe("1.5万");
    });
  });

  describe("設定ボタン", () => {
    it("onSettingsPressが未指定の場合設定ボタンが表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<ProfileHeader user={BASE_USER} />);

      // Assert
      expect(queryByTestId(UNSAFE_root, "profile-settings-button")).toBeNull();
    });

    it("onSettingsPressが指定された場合設定ボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <ProfileHeader user={BASE_USER} onSettingsPress={jest.fn()} />,
      );

      // Assert
      expect(findByTestId(UNSAFE_root, "profile-settings-button")).toBeDefined();
    });

    it("設定ボタンタップ時にonSettingsPressが呼ばれること", () => {
      // Arrange
      const onSettingsPress = jest.fn();
      const { UNSAFE_root } = render(
        <ProfileHeader user={BASE_USER} onSettingsPress={onSettingsPress} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "profile-settings-button"));

      // Assert
      expect(onSettingsPress).toHaveBeenCalledTimes(1);
    });
  });
});
