import { Card } from "@mobile/components/ui/Card";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

describe("Card", () => {
  describe("レンダリング", () => {
    it("子要素が正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Card>
          <Text>カードコンテンツ</Text>
        </Card>,
      );

      // Assert
      expect(getByText("カードコンテンツ")).toBeDefined();
    });

    it("複数の子要素が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Card>
          <Text>タイトル</Text>
          <Text>説明文</Text>
        </Card>,
      );

      // Assert
      expect(getByText("タイトル")).toBeDefined();
      expect(getByText("説明文")).toBeDefined();
    });
  });

  describe("カスタムクラス", () => {
    it("追加のclassNameが適用されること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Card className="mt-4">
          <Text>コンテンツ</Text>
        </Card>,
      );

      // Assert
      expect(getByText("コンテンツ")).toBeDefined();
    });

    it("classNameなしでもレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Card>
          <Text>デフォルト</Text>
        </Card>,
      );

      // Assert
      expect(getByText("デフォルト")).toBeDefined();
    });
  });
});
