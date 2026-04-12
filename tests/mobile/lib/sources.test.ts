import {
  getSourceDefinition,
  SOURCE_CONFIG,
  SOURCE_DEFINITIONS,
  SUPPORTED_SOURCE_COUNT,
  SUPPORTED_SOURCES,
} from "@/lib/sources";

describe("SOURCE_DEFINITIONS", () => {
  it("youtubeが含まれていること", () => {
    // Arrange
    const ids = SOURCE_DEFINITIONS.map(({ id }) => id);

    // Act / Assert
    expect(ids).toContain("youtube");
  });

  it("各定義にid・label・badgeClassNameが含まれていること", () => {
    for (const def of SOURCE_DEFINITIONS) {
      // Assert
      expect(typeof def.id).toBe("string");
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.badgeClassName.length).toBeGreaterThan(0);
    }
  });

  it("件数がSUPPORTED_SOURCE_COUNTと一致すること", () => {
    // Assert
    expect(SOURCE_DEFINITIONS.length).toBe(SUPPORTED_SOURCE_COUNT);
  });

  it("各定義のIDに重複がないこと", () => {
    // Arrange
    const ids = SOURCE_DEFINITIONS.map((d) => d.id);

    // Assert
    expect(new Set(ids).size).toBe(SOURCE_DEFINITIONS.length);
  });
});

describe("SUPPORTED_SOURCES", () => {
  it("youtubeが含まれていること", () => {
    // Assert
    expect(SUPPORTED_SOURCES).toContain("youtube");
  });
});

describe("getSourceDefinition", () => {
  it("youtubeを渡したときyoutube定義を返すこと", () => {
    // Act
    const result = getSourceDefinition("youtube");

    // Assert
    expect(result.id).toBe("youtube");
    expect(result.label).toBe("YouTube");
  });

  it("zennを渡したときzenn定義を返すこと", () => {
    // Act
    const result = getSourceDefinition("zenn");

    // Assert
    expect(result.id).toBe("zenn");
    expect(result.label).toBe("Zenn");
  });

  it("qiitaを渡したときqiita定義を返すこと", () => {
    // Act
    const result = getSourceDefinition("qiita");

    // Assert
    expect(result.id).toBe("qiita");
    expect(result.label).toBe("Qiita");
  });

  it("otherを渡したときother定義を返すこと", () => {
    // Act
    const result = getSourceDefinition("other");

    // Assert
    expect(result.id).toBe("other");
    expect(result.label).toBe("その他");
  });
});

describe("SOURCE_CONFIG", () => {
  it("SOURCE_CONFIGにyoutubeエントリが登録されていること", () => {
    // Assert
    expect(SOURCE_CONFIG.youtube.label).toBe("YouTube");
    expect(SOURCE_CONFIG.youtube.id).toBe("youtube");
  });
});

describe("SOURCE_FILTER_OPTIONS", () => {
  it("SOURCE_FILTER_OPTIONSをインポートできること", () => {
    // Arrange
    const { SOURCE_FILTER_OPTIONS } = require("@/lib/sources");

    // Assert
    expect(SOURCE_FILTER_OPTIONS).toBeDefined();
    expect(Array.isArray(SOURCE_FILTER_OPTIONS)).toBe(true);
  });

  it("先頭要素が「すべて」エントリ（value: undefined）であること", () => {
    // Arrange
    const { SOURCE_FILTER_OPTIONS } = require("@/lib/sources");

    // Act
    const first = SOURCE_FILTER_OPTIONS[0];

    // Assert
    expect(first.value).toBeUndefined();
    expect(first.i18nKey).toBe("home.filterAll");
  });

  it("SOURCE_DEFINITIONS の各ソースが含まれること", () => {
    // Arrange
    const { SOURCE_FILTER_OPTIONS } = require("@/lib/sources");
    const sourceValues = SOURCE_FILTER_OPTIONS.slice(1).map((opt: { value: string }) => opt.value);

    // Assert
    for (const def of SOURCE_DEFINITIONS) {
      expect(sourceValues).toContain(def.id);
    }
  });

  it("各ソースエントリに value と label が含まれること", () => {
    // Arrange
    const { SOURCE_FILTER_OPTIONS } = require("@/lib/sources");
    const sourceOptions = SOURCE_FILTER_OPTIONS.slice(1);

    // Assert
    for (const opt of sourceOptions) {
      expect(typeof opt.value).toBe("string");
      expect(typeof opt.label).toBe("string");
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });

  it("手書き配列でなくSOURCE_DEFINITIONSと件数が一致すること", () => {
    // Arrange
    const { SOURCE_FILTER_OPTIONS } = require("@/lib/sources");

    // Act: 先頭の「すべて」エントリを除く
    const sourceOptions = SOURCE_FILTER_OPTIONS.slice(1);

    // Assert
    expect(sourceOptions.length).toBe(SOURCE_DEFINITIONS.length);
  });
});
