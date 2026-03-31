import { fireEvent, render } from "@testing-library/react-native";

import { Toast } from "../Toast";

describe("Toast", () => {
  describe("レンダリング", () => {
    it("visible=trueの場合メッセージが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Toast message="保存しました" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(getByText("保存しました")).toBeTruthy();
    });

    it("visible=falseの場合何も表示されないこと", async () => {
      // Arrange & Act
      const { queryByText } = await render(
        <Toast message="保存しました" visible={false} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(queryByText("保存しました")).toBeNull();
    });
  });

  describe("バリアント", () => {
    it("successバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Toast message="成功" variant="success" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(getByText("成功")).toBeTruthy();
    });

    it("errorバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Toast message="エラー" variant="error" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(getByText("エラー")).toBeTruthy();
    });

    it("infoバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Toast message="お知らせ" variant="info" visible={true} onDismiss={jest.fn()} />,
      );

      // Assert
      expect(getByText("お知らせ")).toBeTruthy();
    });
  });

  describe("インタラクション", () => {
    it("タップ時にonDismissが呼ばれること", async () => {
      // Arrange
      const onDismiss = jest.fn();
      const { getByTestId } = await render(
        <Toast message="タップして閉じる" visible={true} onDismiss={onDismiss} />,
      );

      // Act
      await fireEvent.press(getByTestId("toast-pressable"));

      // Assert
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
