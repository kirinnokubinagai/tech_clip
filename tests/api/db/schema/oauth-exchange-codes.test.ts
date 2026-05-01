import {
  type NewOauthExchangeCode,
  type OauthExchangeCode,
  oauthExchangeCodes,
} from "@api/db/schema/oauth-exchange-codes";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("oauth_exchange_codes schema", () => {
  it("必須フィールドが定義されていること", () => {
    const columns = getTableColumns(oauthExchangeCodes);
    expect(columns.id).toBeDefined();
    expect(columns.codeHash).toBeDefined();
    expect(columns.sessionId).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.sessionToken).toBeDefined();
    expect(columns.refreshTokenPlain).toBeDefined();
    expect(columns.expiresAt).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });

  it("オプションフィールドが定義されていること", () => {
    const columns = getTableColumns(oauthExchangeCodes);
    expect(columns.consumedAt).toBeDefined();
  });

  it("TypeScript 型が正しくエクスポートされること", () => {
    const columns = getTableColumns(oauthExchangeCodes);
    const columnNames = Object.keys(columns);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("codeHash");
    expect(columnNames).toContain("sessionId");
    expect(columnNames).toContain("userId");
    expect(columnNames).toContain("sessionToken");
    expect(columnNames).toContain("refreshTokenPlain");
    expect(columnNames).toContain("expiresAt");
    expect(columnNames).toContain("consumedAt");
    expect(columnNames).toContain("createdAt");

    // 型エクスポートのコンパイル確認
    type _SelectType = OauthExchangeCode;
    type _InsertType = NewOauthExchangeCode;
    expect(true).toBe(true);
  });
});
