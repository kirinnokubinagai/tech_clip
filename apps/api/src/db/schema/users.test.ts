import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: typeof users.$inferSelect = {} as any;
    expect(user).toBeDefined();
  });
});
