<<<<<<< HEAD
import {
  toSummaryLanguageCode,
  toTranslationLanguageCode,
} from "./language-code";
=======
import { toSummaryLanguageCode, toTranslationLanguageCode } from "./language-code";
>>>>>>> origin/main

describe("toSummaryLanguageCode", () => {
  it("日本語を ja に変換できること", () => {
    // Arrange
    const language = "日本語" as const;

    // Act
    const result = toSummaryLanguageCode(language);

    // Assert
    expect(result).toBe("ja");
  });

  it("English を en に変換できること", () => {
    // Arrange
    const language = "English" as const;

    // Act
    const result = toSummaryLanguageCode(language);

    // Assert
    expect(result).toBe("en");
  });
});

describe("toTranslationLanguageCode", () => {
  it("日本語を ja に変換できること", () => {
    // Arrange
    const language = "日本語" as const;

    // Act
    const result = toTranslationLanguageCode(language);

    // Assert
    expect(result).toBe("ja");
  });

  it("English を en に変換できること", () => {
    // Arrange
    const language = "English" as const;

    // Act
    const result = toTranslationLanguageCode(language);

    // Assert
    expect(result).toBe("en");
  });
});
