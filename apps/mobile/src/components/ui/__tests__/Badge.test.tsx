import { render } from "@testing-library/react-native";

import { Badge } from "../Badge";

describe("Badge", () => {
  describe("レンダリング", () => {
    it("テキストが正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Badge>新着</Badge>);

      // Assert
      expect(getByText("新着")).toBeTruthy();
    });
  });

  describe("バリアント", () => {
    it("デフォルトバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Badge>デフォルト</Badge>);

      // Assert
      expect(getByText("デフォルト")).toBeTruthy();
    });

    it("successバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Badge variant="success">完了</Badge>);

      // Assert
      expect(getByText("完了")).toBeTruthy();
    });

    it("warningバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Badge variant="warning">注意</Badge>);

      // Assert
      expect(getByText("注意")).toBeTruthy();
    });

    it("errorバリアントでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<Badge variant="error">エラー</Badge>);

      // Assert
      expect(getByText("エラー")).toBeTruthy();
    });
  });
});
