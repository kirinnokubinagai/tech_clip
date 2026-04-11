import { resolveChineseVariant, UI_TO_API_LANGUAGE } from "@mobile/lib/language-code";

describe("resolveChineseVariant", () => {
  it("zh-Hans-CN が zh-CN に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("zh-Hans-CN", "zh-Hans");

    // Assert
    expect(result).toBe("zh-CN");
  });

  it("zh-Hant-TW が zh-TW に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("zh-Hant-TW", "zh-Hant");

    // Assert
    expect(result).toBe("zh-TW");
  });

  it("zh-HK が zh-TW に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("zh-HK", "zh");

    // Assert
    expect(result).toBe("zh-TW");
  });

  it("zh-Hans のみでも zh-CN に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("", "zh-Hans");

    // Assert
    expect(result).toBe("zh-CN");
  });

  it("zh-Hant のみでも zh-TW に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("", "zh-Hant");

    // Assert
    expect(result).toBe("zh-TW");
  });

  it("zh-CN 明示でも zh-CN に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("zh-CN", "zh");

    // Assert
    expect(result).toBe("zh-CN");
  });

  it("中国語以外は null を返すこと", () => {
    // Arrange & Act & Assert
    expect(resolveChineseVariant("en-US", "en")).toBeNull();
    expect(resolveChineseVariant("ja-JP", "ja")).toBeNull();
  });

  it("zh-SG が zh-CN に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("zh-SG", "zh");

    // Assert
    expect(result).toBe("zh-CN");
  });

  it("zh-Hans-SG が zh-CN に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("zh-Hans-SG", "zh-Hans");

    // Assert
    expect(result).toBe("zh-CN");
  });

  it("zh 単独が zh-CN に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("zh", "zh");

    // Assert
    expect(result).toBe("zh-CN");
  });

  it("languageCode が zh 単独の場合も zh-CN に解決されること", () => {
    // Arrange & Act
    const result = resolveChineseVariant("", "zh");

    // Assert
    expect(result).toBe("zh-CN");
  });
});

describe("UI_TO_API_LANGUAGE", () => {
  describe("ja", () => {
    it("jaがAPIコードjaにマッピングされること", () => {
      // Arrange & Act
      const result = UI_TO_API_LANGUAGE.ja;

      // Assert
      expect(result).toBe("ja");
    });
  });

  describe("en", () => {
    it("enがAPIコードenにマッピングされること", () => {
      // Arrange & Act
      const result = UI_TO_API_LANGUAGE.en;

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
      const result = UI_TO_API_LANGUAGE.ko;

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
