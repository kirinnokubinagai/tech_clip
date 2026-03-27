import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { verifications } from "./verifications";

describe("verifications schema", () => {
  it("Better Auth必須フィールドが定義されていること", () => {
    const columns = getTableColumns(verifications);
    expect(columns.id).toBeDefined();
    expect(columns.identifier).toBeDefined();
    expect(columns.value).toBeDefined();
    expect(columns.expiresAt).toBeDefined();
  });

  it("タイムスタンプフィールドが定義されていること", () => {
    const columns = getTableColumns(verifications);
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    const columns = getTableColumns(verifications);
    const columnNames = Object.keys(columns);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("identifier");
    expect(columnNames).toContain("value");
    expect(columnNames).toContain("expiresAt");
  });
});
