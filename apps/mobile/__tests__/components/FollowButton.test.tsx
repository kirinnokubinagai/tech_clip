import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { FollowButton } from "../../src/components/FollowButton";

describe("FollowButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("未フォロー状態", () => {
    it("フォローするボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowButton userId="user-1" isFollowing={false} />);

      // Assert
      const label = getByTestId("follow-button-label");
      expect(label.props.children).toBe("フォローする");
    });

    it("accessibilityLabelがフォローするになっていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowButton userId="user-1" isFollowing={false} />);

      // Assert
      const button = getByTestId("follow-button");
      expect(button.props.accessibilityLabel).toBe("フォローする");
    });
  });

  describe("フォロー済み状態", () => {
    it("フォロー中ボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowButton userId="user-1" isFollowing={true} />);

      // Assert
      const label = getByTestId("follow-button-label");
      expect(label.props.children).toBe("フォロー中");
    });

    it("accessibilityLabelがフォロー解除になっていること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowButton userId="user-1" isFollowing={true} />);

      // Assert
      const button = getByTestId("follow-button");
      expect(button.props.accessibilityLabel).toBe("フォロー解除");
    });
  });

  describe("インタラクション", () => {
    it("ボタンタップ時にonToggleが正しい引数で呼ばれること", async () => {
      // Arrange
      const onToggle = jest.fn().mockResolvedValue(undefined);
      const { getByTestId } = await render(
        <FollowButton userId="user-1" isFollowing={false} onToggle={onToggle} />,
      );

      // Act
      await fireEvent.press(getByTestId("follow-button"));

      // Assert
      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith("user-1", false);
      });
    });

    it("タップ後にフォロー状態がトグルされること", async () => {
      // Arrange
      const onToggle = jest.fn().mockResolvedValue(undefined);
      const { getByTestId } = await render(
        <FollowButton userId="user-1" isFollowing={false} onToggle={onToggle} />,
      );

      // Act
      await fireEvent.press(getByTestId("follow-button"));

      // Assert
      await waitFor(() => {
        const label = getByTestId("follow-button-label");
        expect(label.props.children).toBe("フォロー中");
      });
    });

    it("onToggleが未指定の場合でもボタンタップできること", async () => {
      // Arrange
      const { getByTestId } = await render(<FollowButton userId="user-1" isFollowing={false} />);

      // Act & Assert
      await act(async () => {
        await fireEvent.press(getByTestId("follow-button"));
      });
    });

    it("onToggleがエラーをthrowしてもフォロー状態が変化しないこと", async () => {
      // Arrange
      const onToggle = jest.fn().mockRejectedValue(new Error("通信エラー"));
      const { getByTestId } = await render(
        <FollowButton userId="user-1" isFollowing={false} onToggle={onToggle} />,
      );

      // Act
      await fireEvent.press(getByTestId("follow-button"));

      // Assert
      await waitFor(() => {
        const label = getByTestId("follow-button-label");
        expect(label.props.children).toBe("フォローする");
      });
    });
  });

  describe("ローディング状態", () => {
    it("onToggle実行中はボタンがdisabledになること", async () => {
      // Arrange
      let resolveToggle: () => void = () => {};
      const togglePromise = new Promise<void>((r) => {
        resolveToggle = r;
      });
      const onToggle = jest.fn().mockReturnValue(togglePromise);
      const { getByTestId } = await render(
        <FollowButton userId="user-1" isFollowing={false} onToggle={onToggle} />,
      );

      // Act - pressして即座にdisabled状態を確認、その後resolveして完了
      const pressPromise = fireEvent.press(getByTestId("follow-button"));

      // Assert - ローディング中はdisabledになること
      await waitFor(() => {
        const button = getByTestId("follow-button");
        expect(button.props.accessibilityState?.disabled).toBe(true);
      });

      resolveToggle();
      await pressPromise;
      expect(onToggle).toHaveBeenCalledWith("user-1", false);
    });
  });
});
