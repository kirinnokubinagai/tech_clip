import { describe, expect, it } from "vitest";

import {
  createExcerpt,
  EXCERPT_MAX_LENGTH,
} from "../../../../apps/api/src/services/parsers/_shared";

describe("createExcerpt", () => {
  it("空文字をそのまま返すこと", () => {
    // Arrange
    const text = "";

    // Act
    const result = createExcerpt(text);

    // Assert
    expect(result).toBe("");
  });

  it("最大文字数より1文字少ないテキストをそのまま返すこと", () => {
    // Arrange
    const text = "a".repeat(EXCERPT_MAX_LENGTH - 1);

    // Act
    const result = createExcerpt(text);

    // Assert
    expect(result).toBe(text);
  });

  it("ちょうど最大文字数のテキストをそのまま返すこと", () => {
    // Arrange
    const text = "a".repeat(EXCERPT_MAX_LENGTH);

    // Act
    const result = createExcerpt(text);

    // Assert
    expect(result).toHaveLength(EXCERPT_MAX_LENGTH);
    expect(result).toBe(text);
  });

  it("最大文字数+1文字のテキストを切り詰めて...を付与すること", () => {
    // Arrange
    const text = "a".repeat(EXCERPT_MAX_LENGTH + 1);

    // Act
    const result = createExcerpt(text);

    // Assert
    expect(result).toBe(`${"a".repeat(EXCERPT_MAX_LENGTH)}...`);
  });

  it("長いテキストをEXCERPT_MAX_LENGTH文字で切り詰めること", () => {
    // Arrange
    const text = "a".repeat(EXCERPT_MAX_LENGTH * 2);

    // Act
    const result = createExcerpt(text);

    // Assert
    expect(result).toBe(`${"a".repeat(EXCERPT_MAX_LENGTH)}...`);
  });

  it("切り詰めたテキストが...で終わること", () => {
    // Arrange
    const text = "a".repeat(EXCERPT_MAX_LENGTH + 50);

    // Act
    const result = createExcerpt(text);

    // Assert
    expect(result.endsWith("...")).toBe(true);
  });
});
