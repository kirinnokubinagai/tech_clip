import {
  useArticleDetail,
  useCloneArticle,
  useSummaryJobStatus,
  useToggleFavorite,
  useTranslationJobStatus,
  useUpdateArticleContent,
} from "@mobile/hooks/use-articles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import { apiFetch } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@mobile/lib/localDb", () => ({
  upsertArticle: jest.fn().mockResolvedValue(undefined),
  upsertSummary: jest.fn().mockResolvedValue(undefined),
  upsertTranslation: jest.fn().mockResolvedValue(undefined),
}));

const mockApiFetch = apiFetch as jest.Mock;

/** テスト用QueryClientを生成する */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** テスト用QueryClientProviderラッパーを生成する */
function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

/** テスト用記事詳細レスポンス */
const MOCK_ARTICLE_DETAIL = {
  id: "article-123",
  title: "テスト記事",
  url: "https://example.com/article",
  source: "zenn",
  summary: "テスト要約",
  translation: null,
  isRead: false,
  isFavorite: false,
  publishedAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
  content: "記事本文",
  author: "テスト著者",
  thumbnailUrl: null,
  readingTimeMinutes: 5,
  tags: [],
};

let queryClient: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = createTestQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

describe("useArticleDetail", () => {
  describe("正常系", () => {
    it("記事詳細を取得できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true, data: MOCK_ARTICLE_DETAIL });
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useArticleDetail("article-123", "ja"), {
        wrapper,
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/articles/article-123?language=ja&targetLanguage=ja",
      );
      expect(result.current.data?.id).toBe("article-123");
    });

    it("articleIdが空のときクエリが実行されないこと", async () => {
      // Arrange
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useArticleDetail("", "ja"), { wrapper });

      // Assert
      expect(result.current.fetchStatus).toBe("idle");
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    it("APIがsuccess:falseを返した場合にエラー状態になること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        success: false,
        error: { code: "NOT_FOUND", message: "記事が見つかりません" },
      });
      const wrapper = createWrapper(queryClient);

      // Act
      const { result } = await renderHook(() => useArticleDetail("article-999", "ja"), {
        wrapper,
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("記事が見つかりません");
    });
  });
});

describe("useToggleFavorite", () => {
  describe("正常系", () => {
    it("お気に入りをトグルできること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true });
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useToggleFavorite(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-123", isFavorite: false });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/articles/article-123",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      mockApiFetch.mockRejectedValue(new Error("ネットワークエラー"));
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useToggleFavorite(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-123", isFavorite: false });
      });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});

describe("useUpdateArticleContent", () => {
  describe("正常系", () => {
    it("記事コンテンツを更新できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true });
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useUpdateArticleContent(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-123", content: "新しいコンテンツ" });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/articles/article-123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ content: "新しいコンテンツ" }),
        }),
      );
    });
  });
});

describe("useCloneArticle", () => {
  describe("正常系", () => {
    it("記事をクローンできること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({ success: true, data: { id: "cloned-article-456" } });
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useCloneArticle(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate("article-123");
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/articles/article-123/clone",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});

describe("useSummaryJobStatus", () => {
  describe("正常系", () => {
    it("要約ジョブのステータスを取得できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        success: true,
        data: {
          status: "completed",
          progress: 100,
          jobId: "job-123",
          summary: { summary: "要約完了" },
        },
      });
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useSummaryJobStatus(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-123", jobId: "job-123", language: "ja" });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith("/api/articles/article-123/summary/jobs/job-123");
    });

    it("ジョブが実行中の場合もステータス取得できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        success: true,
        data: { status: "running", progress: 50, jobId: "job-123" },
      });
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useSummaryJobStatus(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({ articleId: "article-123", jobId: "job-123", language: "ja" });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});

describe("useTranslationJobStatus", () => {
  describe("正常系", () => {
    it("翻訳ジョブのステータスを取得できること", async () => {
      // Arrange
      mockApiFetch.mockResolvedValue({
        success: true,
        data: {
          status: "completed",
          progress: 100,
          jobId: "job-456",
          translation: { translatedContent: "翻訳完了テキスト" },
        },
      });
      const wrapper = createWrapper(queryClient);
      const { result } = await renderHook(() => useTranslationJobStatus(), { wrapper });

      // Act
      await act(async () => {
        result.current.mutate({
          articleId: "article-123",
          jobId: "job-456",
          targetLanguage: "en",
        });
      });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiFetch).toHaveBeenCalledWith("/api/articles/article-123/translate/jobs/job-456");
    });
  });
});
