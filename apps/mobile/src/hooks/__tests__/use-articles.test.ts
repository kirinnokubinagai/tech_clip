import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import { useSearchArticles } from "../use-articles";

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

/** 記事一覧のモックレスポンス */
const mockArticlesResponse = {
  success: true,
  data: [
    {
      id: "01JTEST001",
      title: "TypeScriptの基礎",
      url: "https://example.com/ts-basics",
      source: "zenn",
      summary: "TypeScriptの基礎について",
      isRead: false,
      isFavorite: false,
      publishedAt: "2024-01-01T00:00:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ],
  meta: {
    nextCursor: null,
    hasNext: false,
  },
};

describe("useSearchArticles", () => {
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

  describe("fetchSearchResults", () => {
    it("/api/articles/search エンドポイントを呼ぶこと", async () => {
      // Arrange
      apiFetch.mockResolvedValue(mockArticlesResponse);

      // Act
      const { result } = renderHook(() => useSearchArticles("typescript"), {
        wrapper: Wrapper,
      });

      // Assert
      await waitFor(() => expect(apiFetch).toHaveBeenCalled());

      expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/api/articles/search"));
    });

    it("検索クエリがURLパラメータqとして渡されること", async () => {
      // Arrange
      apiFetch.mockResolvedValue(mockArticlesResponse);

      // Act
      const { result } = renderHook(() => useSearchArticles("typescript"), {
        wrapper: Wrapper,
      });

      // Assert
      await waitFor(() => expect(apiFetch).toHaveBeenCalled());

      const calledUrl = apiFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("q=typescript");
    });

    it("/api/articles（検索エンドポイント以外）を呼ばないこと", async () => {
      // Arrange
      apiFetch.mockResolvedValue(mockArticlesResponse);

      // Act
      const { result } = renderHook(() => useSearchArticles("typescript"), {
        wrapper: Wrapper,
      });

      // Assert
      await waitFor(() => expect(apiFetch).toHaveBeenCalled());

      const calledUrl = apiFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toMatch(/^\/api\/articles\?/);
      expect(calledUrl).not.toBe("/api/articles");
    });

    it("limitパラメータが含まれること", async () => {
      // Arrange
      apiFetch.mockResolvedValue(mockArticlesResponse);

      // Act
      const { result } = renderHook(() => useSearchArticles("typescript"), {
        wrapper: Wrapper,
      });

      // Assert
      await waitFor(() => expect(apiFetch).toHaveBeenCalled());

      const calledUrl = apiFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("limit=");
    });

    it("クエリが空の場合はAPIを呼ばないこと", async () => {
      // Arrange
      apiFetch.mockResolvedValue(mockArticlesResponse);

      // Act
      renderHook(() => useSearchArticles(""), {
        wrapper: Wrapper,
      });

      // Assert - enabled: false なのでAPIは呼ばれない
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it("検索結果が正常に返ること", async () => {
      // Arrange
      apiFetch.mockResolvedValue(mockArticlesResponse);

      // Act
      const { result } = renderHook(() => useSearchArticles("typescript"), {
        wrapper: Wrapper,
      });

      // Assert
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await waitFor(() => expect(apiFetch).toHaveBeenCalled());

      const pages = result.current.data?.pages;
      expect(pages).toBeDefined();
      expect(pages?.[0].items).toHaveLength(1);
      expect(pages?.[0].items[0].title).toBe("TypeScriptの基礎");
    });

    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      apiFetch.mockResolvedValue({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "サーバーエラーが発生しました",
        },
      });

      // Act
      const { result } = renderHook(() => useSearchArticles("typescript"), {
        wrapper: Wrapper,
      });

      // Assert
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await waitFor(() => expect(apiFetch).toHaveBeenCalled());

      expect(result.current.isError).toBe(true);
      expect(result.current.error).not.toBeNull();
    });
  });
});
