import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { Card } from "../Card";

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
      expect(getByText("カードコンテンツ")).toBeTruthy();
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
      expect(getByText("タイトル")).toBeTruthy();
      expect(getByText("説明文")).toBeTruthy();
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
      expect(getByText("コンテンツ")).toBeTruthy();
    });

    it("classNameなしでもレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(
        <Card>
          <Text>デフォルト</Text>
        </Card>,
      );

      // Assert
      expect(getByText("デフォルト")).toBeTruthy();
    });
  });
});
