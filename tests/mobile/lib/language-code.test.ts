import { toSummaryLanguageCode, toTranslationLanguageCode } from "@mobile/lib/language-code";

describe("toSummaryLanguageCode", () => {
  it("ja の場合 ja を返すこと", () => {
    // Arrange
    const language = "ja" as const;

    // Act
    const result = toSummaryLanguageCode(language);

    // Assert
    expect(result).toBe("ja");
  });

  it("en の場合 en を返すこと", () => {
    // Arrange
    const language = "en" as const;

    // Act
    const result = toSummaryLanguageCode(language);

    // Assert
    expect(result).toBe("en");
  });
});

describe("toTranslationLanguageCode", () => {
  it("ja の場合 ja を返すこと", () => {
    // Arrange
    const language = "ja" as const;

    // Act
    const result = toTranslationLanguageCode(language);

    // Assert
    expect(result).toBe("ja");
  });

  it("en の場合 en を返すこと", () => {
    // Arrange
    const language = "en" as const;

    // Act
    const result = toTranslationLanguageCode(language);

    // Assert
    expect(result).toBe("en");
  });
});
