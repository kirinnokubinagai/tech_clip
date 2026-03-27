import { render } from "@testing-library/react-native";
import { Text, View } from "react-native";

import { ArticleDetailHeader } from "../../../src/components/ArticleDetailHeader";

describe("ArticleDetailHeader", () => {
  describe("レンダリング", () => {
    it("記事タイトルが表示されること", () => {
      // Arrange
      const title = "テスト記事タイトル";

      // Act
      const { getByText } = render(
        <ArticleDetailHeader
          title={title}
          source="zenn"
          author="テスト著者"
          publishedAt="2025-01-01T00:00:00Z"
        />,
      );

      // Assert
      expect(getByText(title)).toBeDefined();
    });

    it("記事ソースがバッジとして表示されること", () => {
      // Arrange & Act
      const { getByText } = render(
        <ArticleDetailHeader
          title="タイトル"
          source="qiita"
          author="著者"
          publishedAt="2025-01-01T00:00:00Z"
        />,
      );

      // Assert
      expect(getByText("qiita")).toBeDefined();
    });

    it("著者名が表示されること", () => {
      // Arrange
      const author = "テスト著者名";

      // Act
      const { getByText } = render(
        <ArticleDetailHeader
          title="タイトル"
          source="zenn"
          author={author}
          publishedAt="2025-01-01T00:00:00Z"
        />,
      );

      // Assert
      expect(getByText(author)).toBeDefined();
    });

    it("著者がnullの場合でもクラッシュしないこと", () => {
      // Arrange & Act
      const { toJSON } = render(
        <ArticleDetailHeader
          title="タイトル"
          source="zenn"
          author={null}
          publishedAt="2025-01-01T00:00:00Z"
        />,
      );

      // Assert
      expect(toJSON()).not.toBeNull();
    });

    it("公開日が表示されること", () => {
      // Arrange & Act
      const { getByText } = render(
        <ArticleDetailHeader
          title="タイトル"
          source="zenn"
          author="著者"
          publishedAt="2025-01-01T00:00:00Z"
        />,
      );

      // Assert
      expect(getByText(/2025/)).toBeDefined();
    });
  });
});
