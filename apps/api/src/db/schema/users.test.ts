import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "./users";

describe("users schema", () => {
  it("Better Auth必須フィールドが定義されていること", () => {
    const columns = getTableColumns(users);
    expect(columns.id).toBeDefined();
    expect(columns.email).toBeDefined();
    expect(columns.name).toBeDefined();
    expect(columns.image).toBeDefined();
    expect(columns.emailVerified).toBeDefined();
  });

  it("プロフィール拡張フィールドが定義されていること", () => {
    const columns = getTableColumns(users);
    expect(columns.username).toBeDefined();
    expect(columns.bio).toBeDefined();
    expect(columns.avatarUrl).toBeDefined();
    expect(columns.isProfilePublic).toBeDefined();
  });

  it("サブスク管理フィールドが定義されていること", () => {
    const columns = getTableColumns(users);
    expect(columns.isPremium).toBeDefined();
    expect(columns.freeAiUsesRemaining).toBeDefined();
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    const columns = getTableColumns(users);
    const columnNames = Object.keys(columns);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("email");
    expect(columnNames).toContain("createdAt");
    expect(columnNames).toContain("updatedAt");
    expect(columnNames.length).toBeGreaterThan(10);
  });
});
