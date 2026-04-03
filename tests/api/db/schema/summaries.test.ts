import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { summaries } from "../../../../apps/api/src/db/schema/summaries";

describe("summaries schema", () => {
  it("テーブル名がsummariesであること", () => {
    // Arrange & Act
    const tableName = getTableName(summaries);

    // Assert
    expect(tableName).toBe("summaries");
  });

  it("必須フィールドが定義されていること", () => {
    // Arrange & Act
    const columns = getTableColumns(summaries);

    // Assert
    expect(columns.id).toBeDefined();
    expect(columns.articleId).toBeDefined();
    expect(columns.language).toBeDefined();
    expect(columns.summary).toBeDefined();
    expect(columns.model).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });

  it("idが主キーであること", () => {
    // Arrange & Act
    const columns = getTableColumns(summaries);

    // Assert
    expect(columns.id.primary).toBe(true);
  });

  it("articleIdがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(summaries);

    // Assert
    expect(columns.articleId.notNull).toBe(true);
  });

  it("languageがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(summaries);

    // Assert
    expect(columns.language.notNull).toBe(true);
  });

  it("summaryがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(summaries);

    // Assert
    expect(columns.summary.notNull).toBe(true);
  });

  it("modelがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(summaries);

    // Assert
    expect(columns.model.notNull).toBe(true);
  });

  it("createdAtがNOT NULLであること", () => {
    // Arrange & Act
    const columns = getTableColumns(summaries);

    // Assert
    expect(columns.createdAt.notNull).toBe(true);
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    // Arrange & Act
    const columns = getTableColumns(summaries);
    const columnNames = Object.keys(columns);

    // Assert
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("articleId");
    expect(columnNames).toContain("language");
    expect(columnNames).toContain("summary");
    expect(columnNames).toContain("model");
    expect(columnNames).toContain("createdAt");
  });
});
