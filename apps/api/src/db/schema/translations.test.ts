import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { translations } from "./translations";

describe("translations schema", () => {
  it("テーブル名がtranslationsであること", () => {
    // Arrange & Act
    const tableName = getTableName(translations);

    // Assert
    expect(tableName).toBe("translations");
  });

  it("必須フィールドが定義されていること", () => {
    // Arrange & Act
    const columns = getTableColumns(translations);

    // Assert
    expect(columns.id).toBeDefined();
    expect(columns.articleId).toBeDefined();
    expect(columns.targetLanguage).toBeDefined();
    expect(columns.translatedTitle).toBeDefined();
    expect(columns.translatedContent).toBeDefined();
    expect(columns.model).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });

  it("idが主キーであること", () => {
    // Arrange & Act
    const columns = getTableColumns(translations);

    // Assert
    expect(columns.id.primary).toBe(true);
  });

  it("articleIdがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(translations);

    // Assert
    expect(columns.articleId.notNull).toBe(true);
  });

  it("targetLanguageがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(translations);

    // Assert
    expect(columns.targetLanguage.notNull).toBe(true);
  });

  it("translatedTitleがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(translations);

    // Assert
    expect(columns.translatedTitle.notNull).toBe(true);
  });

  it("translatedContentがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(translations);

    // Assert
    expect(columns.translatedContent.notNull).toBe(true);
  });

  it("modelがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(translations);

    // Assert
    expect(columns.model.notNull).toBe(true);
  });

  it("createdAtがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(translations);

    // Assert
    expect(columns.createdAt.notNull).toBe(true);
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    // Arrange & Act
    const columns = getTableColumns(translations);
    const columnNames = Object.keys(columns);

    // Assert
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("articleId");
    expect(columnNames).toContain("targetLanguage");
    expect(columnNames).toContain("translatedTitle");
    expect(columnNames).toContain("translatedContent");
    expect(columnNames).toContain("model");
    expect(columnNames).toContain("createdAt");
  });
});
