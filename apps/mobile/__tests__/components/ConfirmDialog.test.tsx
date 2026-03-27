import { Alert } from "react-native";

import { confirm } from "../../src/components/ConfirmDialog";

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ConfirmDialog", () => {
  describe("confirm", () => {
    it("Alert.alertが正しいタイトルとメッセージで呼ばれること", () => {
      // Arrange
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      // Act
      confirm({
        title: "削除確認",
        message: "本当に削除しますか？",
        onConfirm,
        onCancel,
      });

      // Assert
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      expect(Alert.alert).toHaveBeenCalledWith(
        "削除確認",
        "本当に削除しますか？",
        expect.any(Array),
      );
    });

    it("dangerバリアントでdestructiveスタイルのボタンが設定されること", () => {
      // Arrange
      const onConfirm = jest.fn();

      // Act
      confirm({
        title: "削除確認",
        message: "この操作は取り消せません",
        variant: "danger",
        onConfirm,
      });

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { text: string }) => b.text !== "キャンセル");
      expect(confirmButton.style).toBe("destructive");
    });

    it("warningバリアントでdefaultスタイルのボタンが設定されること", () => {
      // Arrange
      const onConfirm = jest.fn();

      // Act
      confirm({
        title: "確認",
        message: "続行しますか？",
        variant: "warning",
        onConfirm,
      });

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { text: string }) => b.text !== "キャンセル");
      expect(confirmButton.style).toBe("default");
    });

    it("デフォルトバリアントがdangerであること", () => {
      // Arrange
      const onConfirm = jest.fn();

      // Act
      confirm({
        title: "削除",
        message: "削除しますか？",
        onConfirm,
      });

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { text: string }) => b.text !== "キャンセル");
      expect(confirmButton.style).toBe("destructive");
    });

    it("確認ボタン押下時にonConfirmが呼ばれること", () => {
      // Arrange
      const onConfirm = jest.fn();

      // Act
      confirm({
        title: "削除確認",
        message: "削除しますか？",
        onConfirm,
      });

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const confirmButton = buttons.find((b: { text: string }) => b.text !== "キャンセル");
      confirmButton.onPress();

      // Assert
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("キャンセルボタン押下時にonCancelが呼ばれること", () => {
      // Arrange
      const onCancel = jest.fn();

      // Act
      confirm({
        title: "削除確認",
        message: "削除しますか？",
        onConfirm: jest.fn(),
        onCancel,
      });

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelButton = buttons.find((b: { text: string }) => b.text === "キャンセル");
      cancelButton.onPress();

      // Assert
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("onCancelが未指定でもキャンセルボタンが存在すること", () => {
      // Arrange & Act
      confirm({
        title: "確認",
        message: "続行しますか？",
        onConfirm: jest.fn(),
      });

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelButton = buttons.find((b: { text: string }) => b.text === "キャンセル");
      expect(cancelButton).toBeDefined();
      expect(cancelButton.style).toBe("cancel");
    });

    it("カスタムラベルが適用されること", () => {
      // Arrange & Act
      confirm({
        title: "ログアウト",
        message: "ログアウトしますか？",
        confirmLabel: "ログアウトする",
        cancelLabel: "戻る",
        onConfirm: jest.fn(),
      });

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      expect(buttons[0].text).toBe("戻る");
      expect(buttons[1].text).toBe("ログアウトする");
    });

    it("デフォルトラベルが適用されること", () => {
      // Arrange & Act
      confirm({
        title: "確認",
        message: "実行しますか？",
        onConfirm: jest.fn(),
      });

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      expect(buttons[0].text).toBe("キャンセル");
      expect(buttons[1].text).toBe("削除する");
    });

    it("キャンセルボタンが最初に配置されること", () => {
      // Arrange & Act
      confirm({
        title: "確認",
        message: "実行しますか？",
        onConfirm: jest.fn(),
      });

      // Assert
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      expect(buttons[0].style).toBe("cancel");
    });
  });
});
