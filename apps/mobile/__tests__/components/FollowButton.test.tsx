import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { FollowButton } from "../../src/components/FollowButton";

/**
 * testIDでReactTestInstanceを検索するヘルパー
 */
function findByTestId(root: ReactTestInstance, testId: string): ReactTestInstance {
  return root.findByProps({ testID: testId });
}

describe("FollowButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("未フォロー状態", () => {
    it("フォローするボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<FollowButton userId="user-1" isFollowing={false} />);

      // Assert
      const label = findByTestId(UNSAFE_root, "follow-button-label");
      expect(label.props.children).toBe("フォローする");
    });

    it("accessibilityLabelがフォローするになっていること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<FollowButton userId="user-1" isFollowing={false} />);

      // Assert
      const button = findByTestId(UNSAFE_root, "follow-button");
      expect(button.props.accessibilityLabel).toBe("フォローする");
    });
  });

  describe("フォロー済み状態", () => {
    it("フォロー中ボタンが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<FollowButton userId="user-1" isFollowing={true} />);

      // Assert
      const label = findByTestId(UNSAFE_root, "follow-button-label");
      expect(label.props.children).toBe("フォロー中");
    });

    it("accessibilityLabelがフォロー解除になっていること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<FollowButton userId="user-1" isFollowing={true} />);

      // Assert
      const button = findByTestId(UNSAFE_root, "follow-button");
      expect(button.props.accessibilityLabel).toBe("フォロー解除");
    });
  });

  describe("インタラクション", () => {
    it("ボタンタップ時にonToggleが正しい引数で呼ばれること", async () => {
      // Arrange
      const onToggle = jest.fn().mockResolvedValue(undefined);
      const { UNSAFE_root } = render(
        <FollowButton userId="user-1" isFollowing={false} onToggle={onToggle} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "follow-button"));

      // Assert
      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith("user-1", false);
      });
    });

    it("タップ後にフォロー状態がトグルされること", async () => {
      // Arrange
      const onToggle = jest.fn().mockResolvedValue(undefined);
      const { UNSAFE_root } = render(
        <FollowButton userId="user-1" isFollowing={false} onToggle={onToggle} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "follow-button"));

      // Assert
      await waitFor(() => {
        const label = findByTestId(UNSAFE_root, "follow-button-label");
        expect(label.props.children).toBe("フォロー中");
      });
    });

    it("onToggleが未指定の場合でもボタンタップできること", async () => {
      // Arrange
      const { UNSAFE_root } = render(<FollowButton userId="user-1" isFollowing={false} />);

      // Act & Assert（エラーが発生しないこと）
      await act(async () => {
        fireEvent.press(findByTestId(UNSAFE_root, "follow-button"));
      });
    });

    it("onToggleがエラーをthrowしてもフォロー状態が変化しないこと", async () => {
      // Arrange
      const onToggle = jest.fn().mockRejectedValue(new Error("通信エラー"));
      const { UNSAFE_root } = render(
        <FollowButton userId="user-1" isFollowing={false} onToggle={onToggle} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "follow-button"));

      // Assert
      await waitFor(() => {
        const label = findByTestId(UNSAFE_root, "follow-button-label");
        expect(label.props.children).toBe("フォローする");
      });
    });
  });

  describe("ローディング状態", () => {
    it("onToggle実行中はボタンがdisabledになること", async () => {
      // Arrange
      let resolve: () => void;
      const onToggle = jest.fn().mockReturnValue(
        new Promise<void>((r) => {
          resolve = r;
        }),
      );
      const { UNSAFE_root } = render(
        <FollowButton userId="user-1" isFollowing={false} onToggle={onToggle} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "follow-button"));

      // Assert（ローディング中はdisabled）
      await waitFor(() => {
        const button = findByTestId(UNSAFE_root, "follow-button");
        expect(button.props.disabled).toBe(true);
      });

      // Cleanup
      await act(async () => {
        resolve!();
      });
    });
  });
});
