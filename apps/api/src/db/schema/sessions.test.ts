import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessions } from "./sessions";

describe("sessions schema", () => {
  it("Better Auth必須フィールドが定義されていること", () => {
    const columns = getTableColumns(sessions);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.token).toBeDefined();
    expect(columns.expiresAt).toBeDefined();
  });

  it("オプションフィールドが定義されていること", () => {
    const columns = getTableColumns(sessions);
    expect(columns.ipAddress).toBeDefined();
    expect(columns.userAgent).toBeDefined();
  });

  it("タイムスタンプフィールドが定義されていること", () => {
    const columns = getTableColumns(sessions);
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    const columns = getTableColumns(sessions);
    const columnNames = Object.keys(columns);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("userId");
    expect(columnNames).toContain("token");
    expect(columnNames).toContain("expiresAt");
  });
});
