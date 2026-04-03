import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseZennBook } from "./zenn-book";

/** Zenn Books API のブック情報レスポンス */
const BOOK_RESPONSE = {
  book: {
    slug: "test-book",
    title: "テストブック",
    user: {
      username: "testuser",
      name: "テスト著者",
    },
    published_at: "2024-08-01T00:00:00.000+09:00",
    image_url: "https://res.cloudinary.com/zenn/image/upload/test-book.png",
  },
};

/** Zenn Books API のチャプター一覧レスポンス */
const CHAPTERS_RESPONSE = {
  chapters: [
    {
      slug: "chapter-1",
      title: "はじめに",
      position: 1,
      body_html: "<h1>はじめに</h1><p>第1章の内容です。テストブックの導入部分になります。</p>",
    },
    {
      slug: "chapter-2",
      title: "基本編",
      position: 2,
      body_html: "<h2>基本編</h2><p>第2章では基本的な概念について説明します。</p>",
    },
    {
      slug: "chapter-3",
      title: "応用編",
      position: 3,
      body_html: "<h2>応用編</h2><p>第3章では応用的な内容を扱います。実践例も紹介します。</p>",
    },
  ],
};

/** チャプターが空のレスポンス */
const EMPTY_CHAPTERS_RESPONSE = {
  chapters: [],
};

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseZennBook", () => {
  describe("URL解析", () => {
    it("Zenn BooksのURLからslugを正しく抽出できること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(BOOK_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(CHAPTERS_RESPONSE),
        });

      // Act
      await parseZennBook("https://zenn.dev/testuser/books/test-book");

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://zenn.dev/api/books/test-book",
        expect.objectContaining({ headers: expect.any(Object) }),
      );
    });

    it("不正なURLの場合エラーになること", async () => {
      // Act & Assert
      await expect(
        parseZennBook("https://zenn.dev/testuser/articles/some-article"),
      ).rejects.toThrow("Zenn BooksのURLではありません");
    });

    it("zenn.dev以外のドメインの場合エラーになること", async () => {
      // Act & Assert
      await expect(parseZennBook("https://example.com/user/books/slug")).rejects.toThrow(
        "Zenn BooksのURLではありません",
      );
    });
  });

  describe("正常系", () => {
    it("ブック情報とチャプターを結合してParsedArticleを返せること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(BOOK_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(CHAPTERS_RESPONSE),
        });

      // Act
      const result = await parseZennBook("https://zenn.dev/testuser/books/test-book");

      // Assert
      expect(result.title).toBe("テストブック");
      expect(result.author).toBe("テスト著者");
      expect(result.source).toBe("zenn.dev");
      expect(result.thumbnailUrl).toBe(
        "https://res.cloudinary.com/zenn/image/upload/test-book.png",
      );
      expect(result.publishedAt).toBe("2024-08-01T00:00:00.000+09:00");
    });

    it("全チャプターのbody_htmlがMarkdownに変換されて結合されること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(BOOK_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(CHAPTERS_RESPONSE),
        });

      // Act
      const result = await parseZennBook("https://zenn.dev/testuser/books/test-book");

      // Assert
      expect(result.content).toContain("はじめに");
      expect(result.content).toContain("基本編");
      expect(result.content).toContain("応用編");
    });

    it("読了時間が計算されること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(BOOK_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(CHAPTERS_RESPONSE),
        });

      // Act
      const result = await parseZennBook("https://zenn.dev/testuser/books/test-book");

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("excerptがnullであること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(BOOK_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(CHAPTERS_RESPONSE),
        });

      // Act
      const result = await parseZennBook("https://zenn.dev/testuser/books/test-book");

      // Assert
      expect(result.excerpt).toBeNull();
    });

    it("チャプターがposition順にソートされて結合されること", async () => {
      // Arrange
      const unorderedChapters = {
        chapters: [
          {
            slug: "chapter-3",
            title: "第3章",
            position: 3,
            body_html: "<p>CCC</p>",
          },
          {
            slug: "chapter-1",
            title: "第1章",
            position: 1,
            body_html: "<p>AAA</p>",
          },
          {
            slug: "chapter-2",
            title: "第2章",
            position: 2,
            body_html: "<p>BBB</p>",
          },
        ],
      };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(BOOK_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(unorderedChapters),
        });

      // Act
      const result = await parseZennBook("https://zenn.dev/testuser/books/test-book");

      // Assert
      const aaaIndex = result.content.indexOf("AAA");
      const bbbIndex = result.content.indexOf("BBB");
      const cccIndex = result.content.indexOf("CCC");
      expect(aaaIndex).toBeLessThan(bbbIndex);
      expect(bbbIndex).toBeLessThan(cccIndex);
    });
  });

  describe("異常系", () => {
    it("ブックAPIが404の場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      // Act & Assert
      await expect(parseZennBook("https://zenn.dev/testuser/books/not-found")).rejects.toThrow(
        "ブック情報の取得に失敗しました",
      );
    });

    it("チャプターAPIが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(BOOK_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      // Act & Assert
      await expect(parseZennBook("https://zenn.dev/testuser/books/test-book")).rejects.toThrow(
        "チャプター一覧の取得に失敗しました",
      );
    });

    it("チャプターが空の場合エラーになること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(BOOK_RESPONSE),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(EMPTY_CHAPTERS_RESPONSE),
        });

      // Act & Assert
      await expect(parseZennBook("https://zenn.dev/testuser/books/test-book")).rejects.toThrow(
        "チャプターが見つかりません",
      );
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Act & Assert
      await expect(parseZennBook("https://zenn.dev/testuser/books/test-book")).rejects.toThrow();
    });
  });
});
