import { toSummaryLanguageCode, toTranslationLanguageCode } from "@mobile/lib/language-code";

describe("toSummaryLanguageCode", () => {
  it("jaをjaに変換できること", () => {
    // Arrange
    const language = "ja" as const;

    // Act
    const result = toSummaryLanguageCode(language);

    // Assert
    expect(result).toBe("ja");
  });

  it("enをenに変換できること", () => {
    // Arrange
    const language = "en" as const;

    // Act
    const result = toSummaryLanguageCode(language);

    // Assert
    expect(result).toBe("en");
  });
});

describe("toTranslationLanguageCode", () => {
  it("jaをjaに変換できること", () => {
    // Arrange
    const language = "ja" as const;

    // Act
    const result = toTranslationLanguageCode(language);

    // Assert
    expect(result).toBe("ja");
  });

  it("enをenに変換できること", () => {
    // Arrange
    const language = "en" as const;

    // Act
    const result = toTranslationLanguageCode(language);

    // Assert
    expect(result).toBe("en");
  });
});
