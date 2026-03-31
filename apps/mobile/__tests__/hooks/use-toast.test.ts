import { act, renderHook } from "@testing-library/react-native";

import { useToast } from "../../src/hooks/use-toast";

describe("useToast", () => {
  describe("初期状態", () => {
    it("トーストが非表示で初期化されること", async () => {
      // Arrange & Act
      const { result } = await renderHook(() => useToast());

      // Assert
      expect(result.current.toast.visible).toBe(false);
    });

    it("初期メッセージが空文字であること", async () => {
      // Arrange & Act
      const { result } = await renderHook(() => useToast());

      // Assert
      expect(result.current.toast.message).toBe("");
    });

    it("初期バリアントがinfoであること", async () => {
      // Arrange & Act
      const { result } = await renderHook(() => useToast());

      // Assert
      expect(result.current.toast.variant).toBe("info");
    });
  });

  describe("show", () => {
    it("showを呼ぶとトーストが表示されること", async () => {
      // Arrange
      const { result } = await renderHook(() => useToast());

      // Act
      await act(async () => {
        result.current.show("テストメッセージ");
      });

      // Assert
      expect(result.current.toast.visible).toBe(true);
    });

    it("showを呼ぶとメッセージが設定されること", async () => {
      // Arrange
      const { result } = await renderHook(() => useToast());

      // Act
      await act(async () => {
        result.current.show("テストメッセージ");
      });

      // Assert
      expect(result.current.toast.message).toBe("テストメッセージ");
    });

    it("バリアント未指定の場合infoになること", async () => {
      // Arrange
      const { result } = await renderHook(() => useToast());

      // Act
      await act(async () => {
        result.current.show("テストメッセージ");
      });

      // Assert
      expect(result.current.toast.variant).toBe("info");
    });

    it("successバリアントを指定できること", async () => {
      // Arrange
      const { result } = await renderHook(() => useToast());

      // Act
      await act(async () => {
        result.current.show("成功しました", "success");
      });

      // Assert
      expect(result.current.toast.variant).toBe("success");
    });

    it("errorバリアントを指定できること", async () => {
      // Arrange
      const { result } = await renderHook(() => useToast());

      // Act
      await act(async () => {
        result.current.show("エラーが発生しました", "error");
      });

      // Assert
      expect(result.current.toast.variant).toBe("error");
    });
  });

  describe("dismiss", () => {
    it("dismissを呼ぶとトーストが非表示になること", async () => {
      // Arrange
      const { result } = await renderHook(() => useToast());
      await act(async () => {
        result.current.show("テストメッセージ");
      });

      // Act
      await act(async () => {
        result.current.dismiss();
      });

      // Assert
      expect(result.current.toast.visible).toBe(false);
    });

    it("dismissを呼ぶとメッセージがクリアされること", async () => {
      // Arrange
      const { result } = await renderHook(() => useToast());
      await act(async () => {
        result.current.show("テストメッセージ");
      });

      // Act
      await act(async () => {
        result.current.dismiss();
      });

      // Assert
      expect(result.current.toast.message).toBe("");
    });

    it("dismissを呼ぶとバリアントがinfoにリセットされること", async () => {
      // Arrange
      const { result } = await renderHook(() => useToast());
      await act(async () => {
        result.current.show("エラー", "error");
      });

      // Act
      await act(async () => {
        result.current.dismiss();
      });

      // Assert
      expect(result.current.toast.variant).toBe("info");
    });
  });
});
