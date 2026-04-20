import { useArticles } from "@mobile/hooks/use-articles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

const apiFetch = require("@/lib/api").apiFetch as jest.Mock;

/** テスト用QueryClient */
let queryClient: QueryClient;

/** テスト用QueryClientProviderラッパー */
function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("cursor パラメータの URL エンコード", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("URLSearchParams が cursor を自動エンコードすること（URL 安全性の確認）", () => {
    // Arrange: + / = を含む文字列（旧 base64 形式など）
    const rawCursor = "abc+def/ghi=";

    // Act: URLSearchParams.set() の挙動を確認
    const params = new URLSearchParams();
    params.set("cursor", rawCursor);
    const queryString = params.toString();

    // Assert: + は %2B、/ は %2F、= は %3D にエンコードされること
    expect(queryString).toBe("cursor=abc%2Bdef%2Fghi%3D");

    // デコードすると元の値に戻ること
    const decoded = new URLSearchParams(queryString).get("cursor");
    expect(decoded).toBe(rawCursor);
  });

  it("base64url 形式の cursor が URL に混入しても + / = が生じないこと", () => {
    // base64url: + -> -, / -> _, = 除去済み のため URLSearchParams でエンコード不要
    const base64urlCursor = btoa(JSON.stringify({ createdAt: "2024-01-01T00:00:00.000Z", id: "01JTEST001" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // base64url には + / = が含まれないこと
    expect(base64urlCursor).not.toContain("+");
    expect(base64urlCursor).not.toContain("/");
    expect(base64urlCursor).not.toContain("=");

    // URLSearchParams.set() でエンコードした場合でも元の値として取得できること
    const params = new URLSearchParams();
    params.set("cursor", base64urlCursor);
    expect(params.get("cursor")).toBe(base64urlCursor);
  });

  it("cursor なしの場合は cursor パラメータが URL に含まれないこと", async () => {
    // Arrange
    apiFetch.mockResolvedValue({
      success: true,
      data: [],
      meta: { nextCursor: null, hasNext: false },
    });

    // Act
    const { result } = renderHook(() => useArticles(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());

    // Assert
    const calledUrl = apiFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("cursor=");
    void result;
  });
});
