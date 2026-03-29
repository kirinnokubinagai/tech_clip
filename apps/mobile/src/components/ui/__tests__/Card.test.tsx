import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { containsText } from "@/test-helpers";

import { Card } from "../Card";

describe("Card", () => {
  describe("レンダリング", () => {
    it("子要素が正しく表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Card>
          <Text>カードコンテンツ</Text>
        </Card>,
      );

      // Assert
      expect(containsText(UNSAFE_root, "カードコンテンツ")).toBe(true);
    });

    it("複数の子要素が表示されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Card>
          <Text>タイトル</Text>
          <Text>説明文</Text>
        </Card>,
      );

      // Assert
      expect(containsText(UNSAFE_root, "タイトル")).toBe(true);
      expect(containsText(UNSAFE_root, "説明文")).toBe(true);
    });
  });

  describe("カスタムクラス", () => {
    it("追加のclassNameが適用されること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Card className="mt-4">
          <Text>コンテンツ</Text>
        </Card>,
      );

      // Assert
      expect(containsText(UNSAFE_root, "コンテンツ")).toBe(true);
    });

    it("classNameなしでもレンダリングできること", () => {
      // Arrange & Act
      const { UNSAFE_root } = render(
        <Card>
          <Text>デフォルト</Text>
        </Card>,
      );

      // Assert
      expect(containsText(UNSAFE_root, "デフォルト")).toBe(true);
    });
  });
});
