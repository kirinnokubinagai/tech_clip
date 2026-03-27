import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { articleTags, tags } from "./tags";

describe("tags schema", () => {
  it("必須フィールドが定義されていること", () => {
    const columns = getTableColumns(tags);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.name).toBeDefined();
  });

  it("タイムスタンプフィールドが定義されていること", () => {
    const columns = getTableColumns(tags);
    expect(columns.createdAt).toBeDefined();
  });

  it("nameカラムがnotNullであること", () => {
    const columns = getTableColumns(tags);
    expect(columns.name.notNull).toBe(true);
  });

  it("userIdカラムがnotNullであること", () => {
    const columns = getTableColumns(tags);
    expect(columns.userId.notNull).toBe(true);
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    const tag: typeof tags.$inferSelect = {} as never;
    expect(tag).toBeDefined();
  });
});

describe("articleTags schema", () => {
  it("必須フィールドが定義されていること", () => {
    const columns = getTableColumns(articleTags);
    expect(columns.articleId).toBeDefined();
    expect(columns.tagId).toBeDefined();
  });

  it("articleIdカラムがnotNullであること", () => {
    const columns = getTableColumns(articleTags);
    expect(columns.articleId.notNull).toBe(true);
  });

  it("tagIdカラムがnotNullであること", () => {
    const columns = getTableColumns(articleTags);
    expect(columns.tagId.notNull).toBe(true);
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    const articleTag: typeof articleTags.$inferSelect = {} as never;
    expect(articleTag).toBeDefined();
  });
});
