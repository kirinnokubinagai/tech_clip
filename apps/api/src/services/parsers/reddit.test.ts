import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseReddit } from "./reddit";

/** selftext投稿（Markdown本文あり）のReddit APIレスポンス */
const SELFTEXT_POST_RESPONSE = [
  {
    data: {
      children: [
        {
          data: {
            title: "How to structure a TypeScript monorepo in 2024",
            author: "ts_enthusiast",
            selftext:
              "## Introduction\n\nHere is my approach to structuring a TypeScript monorepo.\n\n## Tools\n\n- Turborepo\n- pnpm workspaces",
            selftext_html: '<div class="md"><h2>Introduction</h2><p>Here is my approach.</p></div>',
            url: "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/",
            created_utc: 1704067200,
            thumbnail: "self",
            subreddit: "typescript",
            is_self: true,
            score: 256,
            num_comments: 42,
          },
        },
      ],
    },
  },
];

/** 外部リンク投稿（selftextなし）のReddit APIレスポンス */
const LINK_POST_RESPONSE = [
  {
    data: {
      children: [
        {
          data: {
            title: "Announcing TypeScript 5.4",
            author: "typescript_team",
            selftext: "",
            selftext_html: null,
            url: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-4/",
            created_utc: 1709251200,
            thumbnail: "https://i.redd.it/preview-image.jpg",
            subreddit: "programming",
            is_self: false,
            score: 1024,
            num_comments: 156,
          },
        },
      ],
    },
  },
];

/** thumbnailが"default"のレスポンス */
const DEFAULT_THUMBNAIL_RESPONSE = [
  {
    data: {
      children: [
        {
          data: {
            title: "No thumbnail post",
            author: "user123",
            selftext: "Some content here.",
            selftext_html: '<div class="md"><p>Some content here.</p></div>',
            url: "https://www.reddit.com/r/webdev/comments/xyz789/no_thumbnail_post/",
            created_utc: 1704067200,
            thumbnail: "default",
            subreddit: "webdev",
            is_self: true,
            score: 10,
            num_comments: 3,
          },
        },
      ],
    },
  },
];

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseReddit", () => {
  describe("URL検証", () => {
    it("Reddit以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseReddit(url)).rejects.toThrow("RedditのURLではありません");
    });

    it("投稿IDが含まれないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://www.reddit.com/r/typescript/";

      // Act & Assert
      await expect(parseReddit(url)).rejects.toThrow("Reddit投稿URLの形式が正しくありません");
    });
  });

  describe("正常系（selftext投稿）", () => {
    it("投稿タイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.title).toBe("How to structure a TypeScript monorepo in 2024");
    });

    it("selftext（Markdown）をコンテンツとして取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.content).toContain("Introduction");
      expect(result.content).toContain("Turborepo");
    });

    it("著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.author).toBe("ts_enthusiast");
    });

    it("公開日をISO 8601形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.publishedAt).toBe("2024-01-01T00:00:00.000Z");
    });

    it("sourceが投稿元ホスト名であること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.source).toBe("www.reddit.com");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("selftext投稿のthumbnailUrlがnullであること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.thumbnailUrl).toBeNull();
    });

    it("正しいJSON APIエンドポイントにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      await parseReddit(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.any(String),
          }),
        }),
      );
    });
  });

  describe("正常系（外部リンク投稿）", () => {
    it("外部リンク投稿のコンテンツにリンク先URLが含まれること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(LINK_POST_RESPONSE),
      });
      const url = "https://www.reddit.com/r/programming/comments/def456/announcing_typescript_54/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.content).toContain(
        "https://devblogs.microsoft.com/typescript/announcing-typescript-5-4/",
      );
    });

    it("外部リンク投稿のthumbnailUrlが取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(LINK_POST_RESPONSE),
      });
      const url = "https://www.reddit.com/r/programming/comments/def456/announcing_typescript_54/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.thumbnailUrl).toBe("https://i.redd.it/preview-image.jpg");
    });
  });

  describe("thumbnailの特殊値", () => {
    it("thumbnailが'default'の場合nullであること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(DEFAULT_THUMBNAIL_RESPONSE),
      });
      const url = "https://www.reddit.com/r/webdev/comments/xyz789/no_thumbnail_post/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.thumbnailUrl).toBeNull();
    });
  });

  describe("異常系", () => {
    it("APIリクエストが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act & Assert
      await expect(parseReddit(url)).rejects.toThrow("Reddit APIからのデータ取得に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act & Assert
      await expect(parseReddit(url)).rejects.toThrow();
    });

    it("レスポンスに投稿データが含まれない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ data: { children: [] } }]),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act & Assert
      await expect(parseReddit(url)).rejects.toThrow("Reddit投稿データの取得に失敗しました");
    });
  });

  describe("URL形式バリエーション", () => {
    it("old.reddit.comのURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://old.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.title).toBe("How to structure a TypeScript monorepo in 2024");
    });

    it("wwwなしのreddit.comのURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.title).toBe("How to structure a TypeScript monorepo in 2024");
    });

    it("末尾にスラッシュがないURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.title).toBe("How to structure a TypeScript monorepo in 2024");
    });

    it("クエリパラメータ付きURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/?utm_source=share";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.title).toBe("How to structure a TypeScript monorepo in 2024");
    });

    it("old.reddit.comのURLがwww.reddit.comのAPIにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://old.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      await parseReddit(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.any(String),
          }),
        }),
      );
    });
  });

  describe("excerptの生成", () => {
    it("selftext投稿でexcerptがnullでないこと", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SELFTEXT_POST_RESPONSE),
      });
      const url =
        "https://www.reddit.com/r/typescript/comments/abc123/how_to_structure_a_typescript_monorepo/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.excerpt).not.toBeNull();
    });

    it("外部リンク投稿でexcerptがnullであること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(LINK_POST_RESPONSE),
      });
      const url = "https://www.reddit.com/r/programming/comments/def456/announcing_typescript_54/";

      // Act
      const result = await parseReddit(url);

      // Assert
      expect(result.excerpt).toBeNull();
    });
  });
});
