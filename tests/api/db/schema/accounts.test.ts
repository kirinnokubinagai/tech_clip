import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts } from "../../../../apps/api/src/db/schema/accounts";

describe("accounts schema", () => {
  it("Better Auth必須フィールドが定義されていること", () => {
    const columns = getTableColumns(accounts);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.accountId).toBeDefined();
    expect(columns.providerId).toBeDefined();
  });

  it("トークン関連フィールドが定義されていること", () => {
    const columns = getTableColumns(accounts);
    expect(columns.accessToken).toBeDefined();
    expect(columns.refreshToken).toBeDefined();
    expect(columns.accessTokenExpiresAt).toBeDefined();
    expect(columns.refreshTokenExpiresAt).toBeDefined();
  });

  it("認証詳細フィールドが定義されていること", () => {
    const columns = getTableColumns(accounts);
    expect(columns.scope).toBeDefined();
    expect(columns.idToken).toBeDefined();
    expect(columns.password).toBeDefined();
  });

  it("タイムスタンプフィールドが定義されていること", () => {
    const columns = getTableColumns(accounts);
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    const columns = getTableColumns(accounts);
    const columnNames = Object.keys(columns);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("userId");
    expect(columnNames).toContain("accountId");
    expect(columnNames).toContain("providerId");
  });
});
