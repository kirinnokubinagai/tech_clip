import { Alert } from "react-native";

import { useConfirm } from "../../src/hooks/use-confirm";

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useConfirm", () => {
  it("関数を返すこと", () => {
    // Arrange & Act
    const showConfirm = useConfirm();

    // Assert
    expect(typeof showConfirm).toBe("function");
  });

  it("呼び出し時にAlert.alertが呼ばれること", () => {
    // Arrange
    const showConfirm = useConfirm();

    // Act
    showConfirm({
      title: "削除確認",
      message: "削除しますか？",
      onConfirm: jest.fn(),
    });

    // Assert
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it("プリセットオプションとマージされること", () => {
    // Arrange
    const showConfirm = useConfirm({
      variant: "warning",
      cancelLabel: "やめる",
    });

    // Act
    showConfirm({
      title: "確認",
      message: "続行しますか？",
      onConfirm: jest.fn(),
    });

    // Assert
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const confirmButton = buttons.find((b: { text: string }) => b.text !== "やめる");
    expect(confirmButton.style).toBe("default");
    expect(buttons[0].text).toBe("やめる");
  });

  it("呼び出し時のオプションがプリセットを上書きすること", () => {
    // Arrange
    const showConfirm = useConfirm({
      variant: "warning",
      confirmLabel: "続行する",
    });

    // Act
    showConfirm({
      title: "削除",
      message: "削除しますか？",
      variant: "danger",
      confirmLabel: "削除する",
      onConfirm: jest.fn(),
    });

    // Assert
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    const confirmButton = buttons.find((b: { text: string }) => b.text === "削除する");
    expect(confirmButton.style).toBe("destructive");
  });
});
