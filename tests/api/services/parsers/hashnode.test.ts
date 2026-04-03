import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseHashnode } from "../../../../apps/api/src/services/parsers/hashnode";

/** Hashnode GraphQL API 正常レスポンスのモックデータ */
const SAMPLE_GRAPHQL_RESPONSE = {
  data: {
    publication: {
      post: {
        title: "Building a REST API with Hono and Cloudflare Workers",
        contentMarkdown:
          "## Introduction\n\nHono is a fast web framework for Cloudflare Workers.\n\n## Getting Started\n\nInstall Hono with `npm install hono`.",
        author: {
          name: "hashnode_author",
        },
        coverImage: {
          url: "https://cdn.hashnode.com/res/hashnode/image/upload/cover.png",
        },
        publishedAt: "2024-09-15T10:00:00.000Z",
      },
    },
  },
};

/** coverImageがnullのレスポンス */
const RESPONSE_WITHOUT_COVER_IMAGE = {
  data: {
    publication: {
      post: {
        ...SAMPLE_GRAPHQL_RESPONSE.data.publication.post,
        coverImage: null,
      },
    },
  },
};

/** postがnullのレスポンス（記事が見つからない場合） */
const RESPONSE_POST_NOT_FOUND = {
  data: {
    publication: {
      post: null,
    },
  },
};

/** publicationがnullのレスポンス（ブログが見つからない場合） */
const RESPONSE_PUBLICATION_NOT_FOUND = {
  data: {
    publication: null,
  },
};

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseHashnode", () => {
  describe("URL検証", () => {
    it("Hashnode以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseHashnode(url)).rejects.toThrow("HashnodeのURLではありません");
    });

    it("記事slugが含まれないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://blog.hashnode.dev/";

      // Act & Assert
      await expect(parseHashnode(url)).rejects.toThrow("HashnodeのURLからslugを抽出できません");
    });
  });

  describe("正常系", () => {
    it("Hashnode記事のタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.title).toBe("Building a REST API with Hono and Cloudflare Workers");
    });

    it("contentMarkdownからMarkdownコンテンツを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.content).toContain("Introduction");
      expect(result.content).toContain("Hono is a fast web framework for Cloudflare Workers");
    });

    it("著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.author).toBe("hashnode_author");
    });

    it("公開日をISO 8601形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.publishedAt).toBe("2024-09-15T10:00:00.000Z");
    });

    it("sourceが'hashnode.dev'であること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.source).toBe("hashnode.dev");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("サムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.thumbnailUrl).toBe(
        "https://cdn.hashnode.com/res/hashnode/image/upload/cover.png",
      );
    });

    it("GraphQL APIに正しいリクエストを送信すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      await parseHashnode(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://gql.hashnode.com",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: expect.any(String),
        }),
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.variables.host).toBe("blog.hashnode.dev");
      expect(body.variables.slug).toBe("building-a-rest-api-with-hono");
    });
  });

  describe("coverImageがnullの場合", () => {
    it("thumbnailUrlがnullであること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(RESPONSE_WITHOUT_COVER_IMAGE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.thumbnailUrl).toBeNull();
    });
  });

  describe("異常系", () => {
    it("APIリクエストが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act & Assert
      await expect(parseHashnode(url)).rejects.toThrow(
        "Hashnode GraphQL APIからのデータ取得に失敗しました",
      );
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono";

      // Act & Assert
      await expect(parseHashnode(url)).rejects.toThrow();
    });

    it("記事が見つからない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(RESPONSE_POST_NOT_FOUND),
      });
      const url = "https://blog.hashnode.dev/non-existent-post";

      // Act & Assert
      await expect(parseHashnode(url)).rejects.toThrow("Hashnode記事が見つかりません");
    });

    it("publicationが見つからない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(RESPONSE_PUBLICATION_NOT_FOUND),
      });
      const url = "https://nonexistent.hashnode.dev/some-post";

      // Act & Assert
      await expect(parseHashnode(url)).rejects.toThrow("Hashnode記事が見つかりません");
    });
  });

  describe("URL形式バリエーション", () => {
    it("末尾にスラッシュがあるURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono/";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.title).toBe("Building a REST API with Hono and Cloudflare Workers");
    });

    it("クエリパラメータ付きURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://blog.hashnode.dev/building-a-rest-api-with-hono?source=twitter";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.title).toBe("Building a REST API with Hono and Cloudflare Workers");
    });

    it("hashnode.devサブドメインのURLでパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://myblog.hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.title).toBe("Building a REST API with Hono and Cloudflare Workers");
    });

    it("hashnode.devルートドメインのURLでパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_GRAPHQL_RESPONSE),
      });
      const url = "https://hashnode.dev/building-a-rest-api-with-hono";

      // Act
      const result = await parseHashnode(url);

      // Assert
      expect(result.title).toBe("Building a REST API with Hono and Cloudflare Workers");
    });
  });
});
