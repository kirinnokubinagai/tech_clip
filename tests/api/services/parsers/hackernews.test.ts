import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseHackerNews } from "../../../../apps/api/src/services/parsers/hackernews";

/** HN APIレスポンスのモックデータ（外部URL記事） */
const SAMPLE_HN_STORY = {
  id: 12345678,
  type: "story",
  by: "pg",
  time: 1719849600,
  title: "Show HN: A new approach to TypeScript tooling",
  url: "https://example.com/typescript-tooling",
  score: 150,
  descendants: 42,
};

/** HN APIレスポンスのモックデータ（Ask HN / テキスト記事） */
const SAMPLE_HN_TEXT_STORY = {
  id: 87654321,
  type: "story",
  by: "dang",
  time: 1719936000,
  title: "Ask HN: Best practices for API design?",
  text: "<p>I&#x27;m looking for advice on designing REST APIs.</p><p>What are the best patterns you&#x27;ve seen?</p>",
  score: 200,
  descendants: 85,
};

/** HN APIレスポンス（byフィールドなし） */
const SAMPLE_HN_STORY_NO_AUTHOR = {
  id: 11111111,
  type: "story",
  time: 1719849600,
  title: "Anonymous Story",
  url: "https://example.com/anon",
  score: 10,
  descendants: 0,
};

/** genericパーサーから返されるモックデータ */
const MOCK_GENERIC_RESULT = {
  title: "External Article Title",
  author: "External Author",
  content: "# External Content\n\nThis is the article body.",
  excerpt: "This is the article body.",
  thumbnailUrl: "https://example.com/og-image.png",
  readingTimeMinutes: 3,
  publishedAt: "2024-07-01T00:00:00Z",
  source: "example.com",
};

vi.mock("../../../../apps/api/src/services/parsers/generic", () => ({
  parseGeneric: vi.fn(),
}));

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseHackerNews", () => {
  describe("URL解析", () => {
    it("Hacker News以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/item?id=12345";

      // Act & Assert
      await expect(parseHackerNews(url)).rejects.toThrow("Hacker News");
    });

    it("item_idが含まれないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://news.ycombinator.com/";

      // Act & Assert
      await expect(parseHackerNews(url)).rejects.toThrow("item_id");
    });

    it("item_idが数値でないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://news.ycombinator.com/item?id=abc";

      // Act & Assert
      await expect(parseHackerNews(url)).rejects.toThrow("item_id");
    });
  });

  describe("正常系（テキスト記事: Ask HN等）", () => {
    it("テキスト記事のタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_TEXT_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=87654321";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.title).toBe("Ask HN: Best practices for API design?");
    });

    it("テキスト記事の著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_TEXT_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=87654321";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.author).toBe("dang");
    });

    it("textフィールドからMarkdownコンテンツに変換できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_TEXT_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=87654321";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.content).toContain("looking for advice");
    });

    it("sourceが'news.ycombinator.com'であること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_TEXT_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=87654321";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.source).toBe("news.ycombinator.com");
    });

    it("UNIXタイムスタンプからISO 8601形式の公開日に変換されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_TEXT_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=87654321";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.publishedAt).toBe("2024-07-02T16:00:00.000Z");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_TEXT_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=87654321";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("正常系（外部URL記事）", () => {
    it("外部URLがある場合genericパーサーにフォールバックすること", async () => {
      // Arrange
      const { parseGeneric } = await import("../../../../apps/api/src/services/parsers/generic");
      const mockParseGeneric = vi.mocked(parseGeneric);
      mockParseGeneric.mockResolvedValueOnce(MOCK_GENERIC_RESULT);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=12345678";

      // Act
      await parseHackerNews(url);

      // Assert
      expect(mockParseGeneric).toHaveBeenCalledWith("https://example.com/typescript-tooling");
    });

    it("genericパーサーの結果にHNのタイトルと著者を優先的に使用すること", async () => {
      // Arrange
      const { parseGeneric } = await import("../../../../apps/api/src/services/parsers/generic");
      const mockParseGeneric = vi.mocked(parseGeneric);
      mockParseGeneric.mockResolvedValueOnce(MOCK_GENERIC_RESULT);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=12345678";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.title).toBe("Show HN: A new approach to TypeScript tooling");
      expect(result.author).toBe("pg");
      expect(result.source).toBe("news.ycombinator.com");
    });

    it("genericパーサーのコンテンツが使用されること", async () => {
      // Arrange
      const { parseGeneric } = await import("../../../../apps/api/src/services/parsers/generic");
      const mockParseGeneric = vi.mocked(parseGeneric);
      mockParseGeneric.mockResolvedValueOnce(MOCK_GENERIC_RESULT);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=12345678";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.content).toBe("# External Content\n\nThis is the article body.");
    });

    it("genericパーサーが失敗した場合HN情報のみで返すこと", async () => {
      // Arrange
      const { parseGeneric } = await import("../../../../apps/api/src/services/parsers/generic");
      const mockParseGeneric = vi.mocked(parseGeneric);
      mockParseGeneric.mockRejectedValueOnce(new Error("HTMLの取得に失敗しました"));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=12345678";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.title).toBe("Show HN: A new approach to TypeScript tooling");
      expect(result.author).toBe("pg");
      expect(result.content).toBe("");
    });
  });

  describe("正常系（著者なし）", () => {
    it("byフィールドがない場合authorがnullになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_STORY_NO_AUTHOR),
      });
      const { parseGeneric } = await import("../../../../apps/api/src/services/parsers/generic");
      const mockParseGeneric = vi.mocked(parseGeneric);
      mockParseGeneric.mockResolvedValueOnce(MOCK_GENERIC_RESULT);

      const url = "https://news.ycombinator.com/item?id=11111111";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.author).toBeNull();
    });
  });

  describe("APIリクエスト", () => {
    it("正しいHN APIエンドポイントにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_TEXT_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=87654321";

      // Act
      await parseHackerNews(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://hacker-news.firebaseio.com/v0/item/87654321.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("TechClipBot"),
          }),
        }),
      );
    });
  });

  describe("異常系", () => {
    it("HN APIが404を返した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url = "https://news.ycombinator.com/item?id=99999999";

      // Act & Assert
      await expect(parseHackerNews(url)).rejects.toThrow("取得に失敗しました");
    });

    it("HN APIがnullを返した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null),
      });
      const url = "https://news.ycombinator.com/item?id=99999999";

      // Act & Assert
      await expect(parseHackerNews(url)).rejects.toThrow("取得に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://news.ycombinator.com/item?id=12345678";

      // Act & Assert
      await expect(parseHackerNews(url)).rejects.toThrow();
    });
  });

  describe("URL形式バリエーション", () => {
    it("末尾にアンカーがあるURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_TEXT_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=87654321#comments";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.title).toBe("Ask HN: Best practices for API design?");
    });

    it("追加クエリパラメータがあるURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_HN_TEXT_STORY),
      });
      const url = "https://news.ycombinator.com/item?id=87654321&ref=home";

      // Act
      const result = await parseHackerNews(url);

      // Assert
      expect(result.title).toBe("Ask HN: Best practices for API design?");
    });
  });
});
