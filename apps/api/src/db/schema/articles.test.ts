import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { articles } from "./articles";

describe("articles schema", () => {
  it("必須フィールドが定義されていること", () => {
    const columns = getTableColumns(articles);
    expect(columns.id).toBeDefined();
    expect(columns.url).toBeDefined();
    expect(columns.title).toBeDefined();
    expect(columns.source).toBeDefined();
    expect(columns.savedBy).toBeDefined();
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

  it("TypeScript型が正しくエクスポートされること", () => {
    const article: typeof articles.$inferSelect = {} as never;
    expect(article).toBeDefined();
  });
});
