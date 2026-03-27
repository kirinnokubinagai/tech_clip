import { render } from "@testing-library/react-native";

import { ArticleReader } from "../ArticleReader";

describe("ArticleReader", () => {
  describe("レンダリング", () => {
    it("Markdownコンテンツが表示されること", () => {
      // Arrange
      const content = "# テスト見出し\n\nテスト本文です。";

      // Act
      const { getByText } = render(<ArticleReader content={content} />);

      // Assert
      expect(getByText("テスト見出し")).toBeDefined();
      expect(getByText("テスト本文です。")).toBeDefined();
    });

    it("空文字の場合でもクラッシュしないこと", () => {
      // Arrange & Act
      const { toJSON } = render(<ArticleReader content="" />);

      // Assert
      expect(toJSON()).not.toBeNull();
    });

    it("コードブロックを含むMarkdownが表示されること", () => {
      // Arrange
      const content = "```typescript\nconst x = 1;\n```";

      // Act
      const { getByText } = render(<ArticleReader content={content} />);

      // Assert
      expect(getByText(/const x = 1/)).toBeDefined();
    });

    it("リンクを含むMarkdownが表示されること", () => {
      // Arrange
      const content = "[リンクテキスト](https://example.com)";

      // Act
      const { getByText } = render(<ArticleReader content={content} />);

      // Assert
      expect(getByText("リンクテキスト")).toBeDefined();
    });

    it("リスト項目を含むMarkdownが表示されること", () => {
      // Arrange
      const content = "- 項目1\n- 項目2\n- 項目3";

      // Act
      const { getByText } = render(<ArticleReader content={content} />);

      // Assert
      expect(getByText("項目1")).toBeDefined();
      expect(getByText("項目2")).toBeDefined();
      expect(getByText("項目3")).toBeDefined();
    });
  });
});
