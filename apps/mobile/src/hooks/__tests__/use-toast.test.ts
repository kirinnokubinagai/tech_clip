import { act, renderHook } from "@testing-library/react-native";

import { useToast } from "../use-toast";

describe("useToast", () => {
  describe("初期状態", () => {
    it("初期状態ではvisibleがfalseであること", () => {
      // Arrange & Act
      const { result } = renderHook(() => useToast());

      // Assert
      expect(result.current.toast.visible).toBe(false);
      expect(result.current.toast.message).toBe("");
      expect(result.current.toast.variant).toBe("info");
    });
  });

  describe("show", () => {
    it("showを呼ぶとvisibleがtrueになりメッセージが設定されること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());

      // Act
      act(() => {
        result.current.show("保存しました", "success");
      });

      // Assert
      expect(result.current.toast.visible).toBe(true);
      expect(result.current.toast.message).toBe("保存しました");
      expect(result.current.toast.variant).toBe("success");
    });

    it("variantを省略するとinfoがデフォルトになること", () => {
      // Arrange
      const { result } = renderHook(() => useToast());

      // Act
      act(() => {
        result.current.show("お知らせ");
      });

      // Assert
      expect(result.current.toast.variant).toBe("info");
    });
  });

  describe("dismiss", () => {
    it("dismissを呼ぶと初期状態に戻ること", () => {
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
      expect(result.current.toast.visible).toBe(false);
      expect(result.current.toast.message).toBe("");
      expect(result.current.toast.variant).toBe("info");
    });
  });
});
