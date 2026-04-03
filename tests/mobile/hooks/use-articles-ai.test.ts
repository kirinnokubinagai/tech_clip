import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import React from "react";

import { apiFetch } from "@/lib/api";
import {
  useRequestSummary,
  useRequestTranslation,
} from "../../../apps/mobile/src/hooks/use-articles";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

/** テスト用QueryClientを生成する */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/** テスト用Wrapper */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useRequestSummary", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("mutationFn", () => {
    it("articleIdとlanguageをPOSTボディに含めてリクエストを送信できること", async () => {
      // Arrange
      const mockResponse = { success: true, data: { summary: "テスト要約" } };
      (apiFetch as jest.Mock).mockResolvedValue(mockResponse);

      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useRequestSummary(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-123", language: "ja" });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/articles/article-123/summary",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ language: "ja" }),
        }),
      );
    });

    it("languageにjaを明示指定した場合に正しく送信されること", async () => {
      // Arrange
      const mockResponse = { success: true, data: { summary: "テスト要約" } };
      (apiFetch as jest.Mock).mockResolvedValue(mockResponse);

      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useRequestSummary(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-456", language: "ja" });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/articles/article-456/summary",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ language: "ja" }),
        }),
      );
    });

    it("APIエラー時にmutationがエラー状態になること", async () => {
      // Arrange
      const mockError = new Error("APIエラー");
      (apiFetch as jest.Mock).mockRejectedValue(mockError);

      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useRequestSummary(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-789", language: "en" });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert
      expect(result.current.error).toBe(mockError);
    });
  });
});

describe("useRequestTranslation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("mutationFn", () => {
    it("articleIdとtargetLanguageをPOSTボディに含めてリクエストを送信できること", async () => {
      // Arrange
      const mockResponse = { success: true, data: { translation: "テスト翻訳" } };
      (apiFetch as jest.Mock).mockResolvedValue(mockResponse);

      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useRequestTranslation(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-123", targetLanguage: "ja" });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/articles/article-123/translate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ targetLanguage: "ja" }),
        }),
      );
    });

    it("targetLanguageにjaを明示指定した場合に正しく送信されること", async () => {
      // Arrange
      const mockResponse = { success: true, data: { translation: "テスト翻訳" } };
      (apiFetch as jest.Mock).mockResolvedValue(mockResponse);

      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useRequestTranslation(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-456", targetLanguage: "ja" });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Assert
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/articles/article-456/translate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ targetLanguage: "ja" }),
        }),
      );
    });

    it("APIエラー時にmutationがエラー状態になること", async () => {
      // Arrange
      const mockError = new Error("APIエラー");
      (apiFetch as jest.Mock).mockRejectedValue(mockError);

      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useRequestTranslation(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-789", targetLanguage: "en" });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Assert
      expect(result.current.error).toBe(mockError);
    });
  });
});
