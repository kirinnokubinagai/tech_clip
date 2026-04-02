import { renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";

import { useConfirm } from "./use-confirm";

jest.spyOn(Alert, "alert");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useConfirm", () => {
  it("関数を返すこと", async () => {
    // Arrange & Act
    const { result } = await renderHook(() => useConfirm());

    // Assert
    expect(typeof result.current).toBe("function");
  });

  it("呼び出し時にAlert.alertが呼ばれること", async () => {
    // Arrange
    const { result } = await renderHook(() => useConfirm());

    // Act
    result.current({
      title: "削除確認",
      message: "削除しますか？",
      onConfirm: jest.fn(),
    });

    // Assert
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it("プリセットオプションとマージされること", async () => {
    // Arrange
    const { result } = await renderHook(() =>
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

  it("呼び出し時のオプションがプリセットを上書きすること", async () => {
    // Arrange
    const { result } = await renderHook(() =>
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
