import { renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useConfirm } from "../../src/hooks/use-confirm";

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useConfirm", () => {
  it("関数を返すこと", () => {
    // Arrange & Act
    const { result } = renderHook(() => useConfirm());

    // Assert
    expect(typeof result.current).toBe("function");
  });

  it("呼び出し時にAlert.alertが呼ばれること", () => {
    // Arrange
    const { result } = renderHook(() => useConfirm());

    // Act
    result.current({
      title: "削除確認",
      message: "削除しますか？",
      onConfirm: jest.fn(),
    });

    // Assert
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it("プリセットオプションとマージされること", () => {
    // Arrange
    const { result } = renderHook(() =>
      useConfirm({
        variant: "warning",
        cancelLabel: "やめる",
      }),
    );

    // Act
    result.current({
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
    const { result } = renderHook(() =>
      useConfirm({
        variant: "warning",
        confirmLabel: "続行する",
      }),
    );

    // Act
    result.current({
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
