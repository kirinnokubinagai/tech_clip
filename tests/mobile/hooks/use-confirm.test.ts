import { useConfirm } from "@mobile/hooks/use-confirm";
import { renderHook } from "@testing-library/react-native";

/**
 * useConfirm hook のテスト。ConfirmDialog の実装が Alert.alert から custom modal
 * (zustand store) に移行したため、ここでは hook が呼び出し可能で例外を出さない
 * ことのみ検証する。modal 表示・タップ動作の検証は E2E と ConfirmDialog 単体
 * テストで行う。
 */

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

  it("呼び出し時に例外が出ないこと", async () => {
    // Arrange
    const { result } = await renderHook(() => useConfirm());

    // Act / Assert
    expect(() =>
      result.current({
        title: "削除確認",
        message: "削除しますか？",
        onConfirm: jest.fn(),
      }),
    ).not.toThrow();
  });

  it("プリセットオプションを指定しても例外が出ないこと", async () => {
    // Arrange
    const { result } = await renderHook(() =>
      useConfirm({
        variant: "warning",
        cancelLabel: "やめる",
      }),
    );

    // Act / Assert
    expect(() =>
      result.current({
        title: "確認",
        message: "続行しますか？",
        onConfirm: jest.fn(),
      }),
    ).not.toThrow();
  });

  it("呼び出し側で variant を上書きしても例外が出ないこと", async () => {
    // Arrange
    const { result } = await renderHook(() =>
      useConfirm({
        variant: "warning",
      }),
    );

    // Act / Assert
    expect(() =>
      result.current({
        title: "削除",
        message: "削除しますか？",
        variant: "danger",
        onConfirm: jest.fn(),
      }),
    ).not.toThrow();
  });
});
