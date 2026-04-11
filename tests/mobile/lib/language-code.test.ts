import { UI_TO_API_LANGUAGE } from "@mobile/lib/language-code";

describe("UI_TO_API_LANGUAGE", () => {
  describe("ja", () => {
    it("jaがAPIコードjaにマッピングされること", () => {
      // Arrange & Act
      const result = UI_TO_API_LANGUAGE["ja"];

      // Assert
      expect(result).toBe("ja");
    });
  });

  describe("en", () => {
    it("enがAPIコードenにマッピングされること", () => {
      // Arrange & Act
      const result = UI_TO_API_LANGUAGE["en"];

      // Assert
      expect(result).toBe("en");
    });
  });

  describe("zh-CN", () => {
    it("zh-CNがAPIコードzh-CNにマッピングされること", () => {
      // Arrange & Act
      const result = UI_TO_API_LANGUAGE["zh-CN"];

      // Assert
      expect(result).toBe("zh-CN");
    });
  });

  describe("zh-TW", () => {
    it("zh-TWがAPIコードzh-TWにマッピングされること", () => {
      // Arrange & Act
      const result = UI_TO_API_LANGUAGE["zh-TW"];

      // Assert
      expect(result).toBe("zh-TW");
    });
  });

  describe("ko", () => {
    it("koがAPIコードkoにマッピングされること", () => {
      // Arrange & Act
      const result = UI_TO_API_LANGUAGE["ko"];

      // Assert
      expect(result).toBe("ko");
    });
  });

  describe("全言語のマッピングが完全であること", () => {
    it("5言語すべてのマッピングが存在すること", () => {
      // Assert
      const keys = Object.keys(UI_TO_API_LANGUAGE);
      expect(keys).toHaveLength(5);
      expect(keys).toContain("ja");
      expect(keys).toContain("en");
      expect(keys).toContain("zh-CN");
      expect(keys).toContain("zh-TW");
      expect(keys).toContain("ko");
    });
  });
});
