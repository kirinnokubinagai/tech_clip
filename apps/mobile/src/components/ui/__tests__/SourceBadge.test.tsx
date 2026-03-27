import { render } from "@testing-library/react-native";

import { SOURCE_CONFIG, SourceBadge } from "../SourceBadge";
import type { SourceName } from "../SourceBadge";

describe("SourceBadge", () => {
  describe("レンダリング", () => {
    it("ソース名が正しく表示されること", () => {
      // Arrange & Act
      const { getByText } = render(<SourceBadge source="zenn" />);

      // Assert
      expect(getByText("Zenn")).toBeDefined();
    });

    it("表示ラベルがSOURCE_CONFIGに基づくこと", () => {
      // Arrange & Act
      const { getByText } = render(<SourceBadge source="hacker_news" />);

      // Assert
      expect(getByText("Hacker News")).toBeDefined();
    });
  });

  describe("18サイト対応", () => {
    /** 全18サイトのソース名一覧 */
    const ALL_SOURCES: SourceName[] = [
      "zenn",
      "qiita",
      "hatena",
      "note",
      "dev_to",
      "medium",
      "hacker_news",
      "techcrunch",
      "the_verge",
      "wired",
      "ars_technica",
      "github_blog",
      "product_hunt",
      "reddit",
      "lobsters",
      "publickey",
      "gihyo",
      "itmedia",
    ];

    it("SOURCE_CONFIGが18サイト分の設定を持つこと", () => {
      // Assert
      expect(Object.keys(SOURCE_CONFIG)).toHaveLength(18);
    });

    it.each(ALL_SOURCES)("%s のバッジがレンダリングできること", (source) => {
      // Arrange & Act
      const { getByText } = render(<SourceBadge source={source} />);

      // Assert
      const config = SOURCE_CONFIG[source];
      expect(getByText(config.label)).toBeDefined();
    });

    it.each(ALL_SOURCES)("%s のSOURCE_CONFIGにlabelとcolorが定義されていること", (source) => {
      // Assert
      const config = SOURCE_CONFIG[source];
      expect(config.label).not.toBe("");
      expect(config.color).not.toBe("");
    });
  });

  describe("サイズ", () => {
    it("デフォルトサイズ(sm)でレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<SourceBadge source="zenn" />);

      // Assert
      expect(getByText("Zenn")).toBeDefined();
    });

    it("mdサイズでレンダリングできること", () => {
      // Arrange & Act
      const { getByText } = render(<SourceBadge source="zenn" size="md" />);

      // Assert
      expect(getByText("Zenn")).toBeDefined();
    });
  });

  describe("アクセシビリティ", () => {
    it("accessibilityLabelが設定されること", () => {
      // Arrange & Act
      const { getByLabelText } = render(<SourceBadge source="qiita" />);

      // Assert
      expect(getByLabelText("Qiita")).toBeDefined();
    });
  });
});
