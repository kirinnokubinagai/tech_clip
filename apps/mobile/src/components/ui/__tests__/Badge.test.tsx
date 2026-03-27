import { render } from "@testing-library/react-native";

import { Badge } from "../Badge";

describe("Badge", () => {
  describe("レンダリング", () => {
    it("テキストが正しく表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<Badge>新着</Badge>);

      // Assert
      expect(getByText("新着")).toBeDefined();
    });
  });

  describe("バリアント", () => {
    it("デフォルトバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Badge>デフォルト</Badge>);

      // Assert
      expect(getByText("デフォルト")).toBeDefined();
    });

    it("successバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Badge variant="success">完了</Badge>);

      // Assert
      expect(getByText("完了")).toBeDefined();
    });

    it("warningバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Badge variant="warning">注意</Badge>);

      // Assert
      expect(getByText("注意")).toBeDefined();
    });

    it("errorバリアントでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<Badge variant="error">エラー</Badge>);

      // Assert
      expect(getByText("エラー")).toBeDefined();
    });
  });
});
