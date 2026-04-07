import { formatArticleDate } from "@mobile/lib/date-format";

describe("formatArticleDate", () => {
  it("jaロケールで日付が日本語形式でフォーマットされること", () => {
    // Arrange
    const isoString = "2024-03-15T10:30:00Z";

    // Act
    const result = formatArticleDate(isoString, "ja");

    // Assert
    expect(result).toBe("2024/3/15");
  });

  it("enロケールで日付が英語形式でフォーマットされること", () => {
    // Arrange
    const isoString = "2024-03-15T10:30:00Z";

    // Act
    const result = formatArticleDate(isoString, "en");

    // Assert
    expect(result).toBe("3/15/2024");
  });

  it("ロケールを省略した場合にjaとして動作すること", () => {
    // Arrange
    const isoString = "2024-03-15T10:30:00Z";

    // Act
    const result = formatArticleDate(isoString);

    // Assert
    expect(result).toBe("2024/3/15");
  });

  it("月が1桁の日付を正しくフォーマットできること", () => {
    // Arrange
    const isoString = "2024-01-05T00:00:00Z";

    // Act
    const result = formatArticleDate(isoString, "ja");

    // Assert
    expect(result).toBe("2024/1/5");
  });

  it("不正な日付文字列の場合に空文字を返すこと", () => {
    // Arrange
    const isoString = "invalid-date";

    // Act
    const result = formatArticleDate(isoString, "ja");

    // Assert
    expect(result).toBe("");
  });
});
