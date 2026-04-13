import { SOURCE_CONFIG, SourceBadge } from "@mobile/components/ui/SourceBadge";
import { render } from "@testing-library/react-native";

import { SOURCE_DEFINITIONS, SUPPORTED_SOURCES } from "@/lib/sources";

describe("SourceBadge", () => {
  describe("レンダリング", () => {
    it("ソース名が正しく表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<SourceBadge source="zenn" />);

      // Assert
      expect(getByText("Zenn")).toBeDefined();
    });

    it("表示ラベルがsource定義に基づくこと", async () => {
      // Arrange & Act
      const { getByText } = await render(<SourceBadge source="hackernews" />);

      // Assert
      expect(getByText("Hacker News")).toBeDefined();
    });
  });

  describe("source定義の整合性", () => {
    it("SOURCE_CONFIGがsource定義と一致すること", () => {
      expect(Object.keys(SOURCE_CONFIG)).toEqual(SUPPORTED_SOURCES);
      expect(Object.keys(SOURCE_CONFIG)).toHaveLength(SUPPORTED_SOURCES.length);
    });

    it.each(
      SOURCE_DEFINITIONS.map(({ id, label }) => [id, label] as const),
    )("%s のバッジがレンダリングできること", async (source, label) => {
      // Arrange & Act
      const { getByText } = await render(<SourceBadge source={source} />);

      // Assert
      expect(getByText(label)).toBeDefined();
    });

    it.each(
      SOURCE_DEFINITIONS.map(({ id }) => [id] as const),
    )("%s のSOURCE_CONFIGにlabelとcolorが定義されていること", (source) => {
      // Assert
      const config = SOURCE_CONFIG[source];
      expect(config.label).not.toBe("");
      expect(config.badgeClassName).not.toBe("");
    });
  });

  describe("サイズ", () => {
    it("デフォルトサイズ(sm)でレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<SourceBadge source="zenn" />);

      // Assert
      expect(getByText("Zenn")).toBeDefined();
    });

    it("mdサイズでレンダリングできること", async () => {
      // Arrange & Act
      const { getByText } = await render(<SourceBadge source="zenn" size="md" />);

      // Assert
      expect(getByText("Zenn")).toBeDefined();
    });
  });

  describe("アクセシビリティ", () => {
    it("accessibilityLabelが設定されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<SourceBadge source="qiita" />);

      // Assert
      const badge = getByTestId("source-badge");
      expect(badge.props.accessibilityLabel).toBe("Qiita");
    });
  });
});
