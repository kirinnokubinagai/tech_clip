import { fireEvent, render } from "@testing-library/react-native";

import { containsText, findByTestId, queryByTestId } from "@/test-helpers";

import { Toast } from "../Toast";

describe("Toast", () => {
  describe("レンダリング", () => {
    it("visible=trueの場合メッセージが表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Toast message="保存しました" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "保存しました")).toBe(true);
    });

    it("visible=falseの場合何も表示されないこと", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Toast message="保存しました" visible={false} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "保存しました")).toBe(false);
    });
  });

  describe("バリアント", () => {
    it("successバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Toast message="成功" variant="success" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "成功")).toBe(true);
    });

    it("errorバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Toast message="エラー" variant="error" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "エラー")).toBe(true);
    });

    it("infoバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Toast message="お知らせ" variant="info" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(containsText(UNSAFE_root, "お知らせ")).toBe(true);
    });
  });

  describe("インタラクション", () => {
    it("タップ時にonDismissが呼ばれること", () => {
      // Arrange
      const onDismiss = jest.fn();
      const { UNSAFE_root } = render(
        <Toast message="タップして閉じる" visible={true} onDismiss={onDismiss} />,
      );

      // Act
      fireEvent.press(findByTestId(UNSAFE_root, "toast-pressable"));

      // Assert
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
