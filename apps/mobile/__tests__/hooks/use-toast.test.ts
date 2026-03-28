import { act, renderHook } from "@testing-library/react-native";

import { useToast } from "../../src/hooks/use-toast";

describe("useToast", () => {
  describe("初期状態", () => {
    it("トーストが非表示で初期化されること", () => {
      // Arrange & Act
      const { result } = renderHook(() => useToast());

      // Assert
      expect(result.current.toast.visible).toBe(false);
    });

    it("初期メッセージが空文字であること", () => {
      // Arrange & Act
      const { result } = renderHook(() => useToast());

      // Assert
      expect(result.current.toast.message).toBe("");
    });

    it("初期バリアントがinfoであること", () => {
      // Arrange & Act
      const { result } = renderHook(() => useToast());

      // Assert
      expect(result.current.toast.variant).toBe("info");
    });
  });

  describe("show", () => {
    it("showを呼ぶとトーストが表示されること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());

      // Act
      act(() => {
        result.current.show("テストメッセージ");
      });

      // Assert
      expect(result.current.toast.visible).toBe(true);
    });

    it("showを呼ぶとメッセージが設定されること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());

      // Act
      act(() => {
        result.current.show("テストメッセージ");
      });

      // Assert
      expect(result.current.toast.message).toBe("テストメッセージ");
    });

    it("バリアント未指定の場合infoになること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());

      // Act
      act(() => {
        result.current.show("テストメッセージ");
      });

      // Assert
      expect(result.current.toast.variant).toBe("info");
    });

    it("successバリアントを指定できること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());

      // Act
      act(() => {
        result.current.show("成功しました", "success");
      });

      // Assert
      expect(result.current.toast.variant).toBe("success");
    });

    it("errorバリアントを指定できること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());

      // Act
      act(() => {
        result.current.show("エラーが発生しました", "error");
      });

      // Assert
      expect(result.current.toast.variant).toBe("error");
    });
  });

  describe("dismiss", () => {
    it("dismissを呼ぶとトーストが非表示になること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());
      act(() => {
        result.current.show("テストメッセージ");
      });

      // Act
      act(() => {
        result.current.dismiss();
      });

      // Assert
      expect(result.current.toast.visible).toBe(false);
    });

    it("dismissを呼ぶとメッセージがクリアされること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());
      act(() => {
        result.current.show("テストメッセージ");
      });

      // Act
      act(() => {
        result.current.dismiss();
      });

      // Assert
      expect(result.current.toast.message).toBe("");
    });

    it("dismissを呼ぶとバリアントがinfoにリセットされること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());
      act(() => {
        result.current.show("エラー", "error");
      });

      // Act
      act(() => {
        result.current.dismiss();
      });

      // Assert
      expect(result.current.toast.variant).toBe("info");
    });
  });
});
