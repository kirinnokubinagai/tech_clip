import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { notifications } from "./notifications";

describe("notifications schema", () => {
  it("必須フィールドが定義されていること", () => {
    const columns = getTableColumns(notifications);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.type).toBeDefined();
    expect(columns.title).toBeDefined();
    expect(columns.body).toBeDefined();
  });

  it("オプションフィールドが定義されていること", () => {
    const columns = getTableColumns(notifications);
    expect(columns.isRead).toBeDefined();
    expect(columns.data).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });

  it("isReadのデフォルト値がfalseであること", () => {
    const columns = getTableColumns(notifications);
    expect(columns.isRead.default).toBe(false);
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    const columns = getTableColumns(notifications);
    const columnNames = Object.keys(columns);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("userId");
    expect(columnNames).toContain("type");
    expect(columnNames).toContain("title");
    expect(columnNames).toContain("body");
    expect(columnNames).toContain("isRead");
    expect(columnNames).toContain("data");
    expect(columnNames).toContain("createdAt");
  });
});
