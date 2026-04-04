import { parseFreecodecamp } from "@api/services/parsers/freecodecamp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** freeCodeCamp記事のHTMLテンプレート */
const SAMPLE_FREECODECAMP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>How to Build a REST API with Node.js</title>
  <meta property="og:title" content="How to Build a REST API with Node.js" />
  <meta property="og:image" content="https://www.freecodecamp.org/news/content/images/2024/01/rest-api-cover.png" />
  <meta property="article:author" content="https://www.freecodecamp.org/news/author/testauthor/" />
  <meta property="article:published_time" content="2024-07-20T09:00:00.000Z" />
  <meta name="author" content="fccテスト著者" />
</head>
<body>
  <article>
    <h1>How to Build a REST API with Node.js</h1>
    <p>In this tutorial, you will learn how to build a RESTful API using Node.js and Express.</p>
    <p>REST APIs are the backbone of modern web applications.</p>
    <h2>Prerequisites</h2>
    <p>Before we start, make sure you have Node.js installed on your machine.</p>
    <p>You should also be familiar with JavaScript fundamentals.</p>
    <p>Let's get started with our project setup.</p>
  </article>
</body>
</html>
`;

/** OGPメタタグなしのHTML */
const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>最小限のfreeCodeCamp記事</title>
</head>
<body>
  <article>
    <h1>最小限のfreeCodeCamp記事</h1>
    <p>メタ情報のない記事です。本文のみ含まれています。</p>
    <p>Readabilityが認識できるように複数の段落を用意します。</p>
    <p>段落を追加してコンテンツ量を確保します。</p>
    <p>さらに追加の段落でボリュームを増やします。</p>
    <p>最後の段落です。パーサーのテストに使用します。</p>
  </article>
</body>
</html>
`;

/** 本文が空のHTML */
const EMPTY_CONTENT_HTML = `
<!DOCTYPE html>
<html>
<head><title>空の記事</title></head>
<body></body>
</html>
`;

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseFreecodecamp", () => {
  describe("URL検証", () => {
    it("freeCodeCamp以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseFreecodecamp(url)).rejects.toThrow("freeCodeCampのURLではありません");
    });

    it("www.freecodecamp.orgドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_FREECODECAMP_HTML),
      });
      const url = "https://www.freecodecamp.org/news/how-to-build-rest-api/";

      // Act
      const result = await parseFreecodecamp(url);

      // Assert
      expect(result.source).toBe("www.freecodecamp.org");
    });

    it("freecodecamp.orgドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_FREECODECAMP_HTML),
      });
      const url = "https://freecodecamp.org/news/how-to-build-rest-api/";

      // Act
      const result = await parseFreecodecamp(url);

      // Assert
      expect(result.source).toBe("freecodecamp.org");
    });
  });

  describe("正常系", () => {
    it("記事のタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_FREECODECAMP_HTML),
      });
      const url = "https://www.freecodecamp.org/news/how-to-build-rest-api/";

      // Act
      const result = await parseFreecodecamp(url);

      // Assert
      expect(result.title).toBe("How to Build a REST API with Node.js");
    });

    it("記事本文をMarkdown形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_FREECODECAMP_HTML),
      });
      const url = "https://www.freecodecamp.org/news/how-to-build-rest-api/";

      // Act
      const result = await parseFreecodecamp(url);

      // Assert
      expect(result.content).toContain("RESTful API");
    });

    it("OGPメタタグからサムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_FREECODECAMP_HTML),
      });
      const url = "https://www.freecodecamp.org/news/how-to-build-rest-api/";

      // Act
      const result = await parseFreecodecamp(url);

      // Assert
      expect(result.thumbnailUrl).toBe(
        "https://www.freecodecamp.org/news/content/images/2024/01/rest-api-cover.png",
      );
    });

    it("metaタグから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_FREECODECAMP_HTML),
      });
      const url = "https://www.freecodecamp.org/news/how-to-build-rest-api/";

      // Act
      const result = await parseFreecodecamp(url);

      // Assert
      expect(result.author).toBe("fccテスト著者");
    });

    it("公開日をISO 8601形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_FREECODECAMP_HTML),
      });
      const url = "https://www.freecodecamp.org/news/how-to-build-rest-api/";

      // Act
      const result = await parseFreecodecamp(url);

      // Assert
      expect(result.publishedAt).toBe("2024-07-20T09:00:00.000Z");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_FREECODECAMP_HTML),
      });
      const url = "https://www.freecodecamp.org/news/how-to-build-rest-api/";

      // Act
      const result = await parseFreecodecamp(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("OGPメタタグなし", () => {
    it("メタタグがない場合でも記事を抽出できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_HTML),
      });
      const url = "https://www.freecodecamp.org/news/minimal-article/";

      // Act
      const result = await parseFreecodecamp(url);

      // Assert
      expect(result.title).toBe("最小限のfreeCodeCamp記事");
      expect(result.content).toContain("メタ情報のない記事");
      expect(result.thumbnailUrl).toBeNull();
      expect(result.author).toBeNull();
      expect(result.publishedAt).toBeNull();
    });
  });

  describe("異常系", () => {
    it("fetchが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url = "https://www.freecodecamp.org/news/not-found/";

      // Act & Assert
      await expect(parseFreecodecamp(url)).rejects.toThrow("freeCodeCamp記事の取得に失敗しました");
    });

    it("本文が抽出できない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_CONTENT_HTML),
      });
      const url = "https://www.freecodecamp.org/news/empty/";

      // Act & Assert
      await expect(parseFreecodecamp(url)).rejects.toThrow(
        "freeCodeCamp記事の本文の抽出に失敗しました",
      );
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://www.freecodecamp.org/news/error/";

      // Act & Assert
      await expect(parseFreecodecamp(url)).rejects.toThrow();
    });
  });

  describe("fetchリクエスト", () => {
    it("User-Agentヘッダーを送信すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_FREECODECAMP_HTML),
      });
      const url = "https://www.freecodecamp.org/news/how-to-build-rest-api/";

      // Act
      await parseFreecodecamp(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("TechClipBot"),
          }),
        }),
      );
    });
  });
});
