import { render } from "@testing-library/react-native";

import { containsText } from "@/test-helpers";

import { Badge } from "../Badge";

describe("Badge", () => {
  describe("レンダリング", () => {
    it("テキストが正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Badge>新着</Badge>);

      // Assert
      expect(containsText(UNSAFE_root, "新着")).toBe(true);
    });
  });

  describe("バリアント", () => {
    it("デフォルトバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Badge>デフォルト</Badge>);

      // Assert
      expect(containsText(UNSAFE_root, "デフォルト")).toBe(true);
    });

    it("successバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Badge variant="success">完了</Badge>);

      // Assert
      expect(containsText(UNSAFE_root, "完了")).toBe(true);
    });

    it("warningバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Badge variant="warning">注意</Badge>);

      // Assert
      expect(containsText(UNSAFE_root, "注意")).toBe(true);
    });

    it("errorバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(<Badge variant="error">エラー</Badge>);

      // Assert
      expect(containsText(UNSAFE_root, "エラー")).toBe(true);
    });
  });
});
