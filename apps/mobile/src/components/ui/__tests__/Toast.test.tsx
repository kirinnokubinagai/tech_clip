import { fireEvent, render } from "@testing-library/react-native";

import { Toast } from "../Toast";

describe("Toast", () => {
  describe("レンダリング", () => {
    it("visible=trueの場合メッセージが表示されること", () => {
      // Arrange & Act
      const { getByText } = render(
        <Toast message="保存しました" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(getByText("保存しました")).toBeDefined();
    });

    it("visible=falseの場合何も表示されないこと", () => {
      // Arrange & Act
      const { queryByText } = render(
        <Toast message="保存しました" visible={false} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(queryByText("保存しました")).toBeNull();
    });
  });

  describe("バリアント", () => {
    it("successバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(
        <Toast message="成功" variant="success" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(getByText("成功")).toBeDefined();
    });

    it("errorバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(
        <Toast message="エラー" variant="error" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(getByText("エラー")).toBeDefined();
    });

    it("infoバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(
        <Toast message="お知らせ" variant="info" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(getByText("お知らせ")).toBeDefined();
    });
  });

  describe("インタラクション", () => {
    it("タップ時にonDismissが呼ばれること", () => {
      // Arrange
      const onDismiss = jest.fn();
      const { getByRole } = render(
        <Toast message="タップして閉じる" visible={true} onDismiss={onDismiss} />,
      );

      // Act
      fireEvent.press(getByRole("alert"));

      // Assert
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
