import { articles } from "@api/db/schema/articles";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("articles schema", () => {
  it("必須フィールドが定義されていること", () => {
    const columns = getTableColumns(articles);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.url).toBeDefined();
    expect(columns.title).toBeDefined();
    expect(columns.source).toBeDefined();
  });

  it("コンテンツフィールドが定義されていること", () => {
    const columns = getTableColumns(articles);
    expect(columns.content).toBeDefined();
    expect(columns.excerpt).toBeDefined();
    expect(columns.author).toBeDefined();
    expect(columns.thumbnailUrl).toBeDefined();
  });

  it("タイムスタンプフィールドが定義されていること", () => {
    const columns = getTableColumns(articles);
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
    expect(columns.publishedAt).toBeDefined();
  });

  it("ステータスフィールドが定義されていること", () => {
    const columns = getTableColumns(articles);
    expect(columns.readingTimeMinutes).toBeDefined();
    expect(columns.isRead).toBeDefined();
    expect(columns.isFavorite).toBeDefined();
    expect(columns.isPublic).toBeDefined();
  });

  it("isRead/isFavorite/isPublicのデフォルト値がfalseであること", () => {
    const columns = getTableColumns(articles);
    expect(columns.isRead.default).toBe(false);
    expect(columns.isFavorite.default).toBe(false);
    expect(columns.isPublic.default).toBe(false);
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    const article: typeof articles.$inferSelect = {} as never;
    expect(article).toBeDefined();
  });
});
