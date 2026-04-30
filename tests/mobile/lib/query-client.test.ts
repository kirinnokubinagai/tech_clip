/**
 * query-client.ts のテスト
 *
 * テスト環境向けのデフォルト設定（gcTime, retry）を検証する。
 * SessionExpiredError → handleSessionExpired の連携は
 * auth-store.test.ts の checkSession テストが統合的にカバーしている。
 */

import { queryClient } from "@mobile/lib/query-client";

describe("queryClient のデフォルト設定（テスト環境）", () => {
  it("gcTime が 0 であること", () => {
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(0);
  });

  it("retry が false であること", () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
  });

  it("staleTime が設定されていること", () => {
    const staleTime = queryClient.getDefaultOptions().queries?.staleTime;
    expect(typeof staleTime).toBe("number");
    expect(staleTime).toBeGreaterThan(0);
  });

  it("QueryCache の onError ハンドラが設定されていること", () => {
    expect(queryClient.getQueryCache().config.onError).toBeDefined();
  });

  it("MutationCache の onError ハンドラが設定されていること", () => {
    expect(queryClient.getMutationCache().config.onError).toBeDefined();
  });
});
