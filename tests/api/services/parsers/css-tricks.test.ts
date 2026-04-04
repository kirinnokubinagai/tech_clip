import { parseCssTricks } from "@api/services/parsers/css-tricks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** CSS-Tricks記事のHTMLテンプレート */
const SAMPLE_CSS_TRICKS_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>A Complete Guide to Flexbox</title>
  <meta property="og:title" content="A Complete Guide to Flexbox" />
  <meta property="og:image" content="https://css-tricks.com/wp-content/uploads/2024/03/flexbox-guide.png" />
  <meta property="article:author" content="https://css-tricks.com/author/testauthor/" />
  <meta property="article:published_time" content="2024-05-10T08:30:00.000Z" />
  <meta name="author" content="CSS-Tricksテスト著者" />
</head>
<body>
  <article>
    <h1>A Complete Guide to Flexbox</h1>
    <p>Flexbox is a one-dimensional layout method for arranging items in rows or columns.</p>
    <p>It makes it easier to design flexible responsive layout structures.</p>
    <h2>Flexbox Properties</h2>
    <p>The flex container becomes flexible by setting the display property to flex.</p>
    <p>The flex-direction property defines the direction of the flex items.</p>
    <p>Understanding these properties is essential for modern CSS layouts.</p>
  </article>
</body>
</html>
`;

/** OGPメタタグなしのHTML */
const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>最小限のCSS-Tricks記事</title>
</head>
<body>
  <article>
    <h1>最小限のCSS-Tricks記事</h1>
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

describe("parseCssTricks", () => {
  describe("URL検証", () => {
    it("CSS-Tricks以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseCssTricks(url)).rejects.toThrow("CSS-TricksのURLではありません");
    });

    it("css-tricks.comドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_CSS_TRICKS_HTML),
      });
      const url = "https://css-tricks.com/a-complete-guide-to-flexbox/";

      // Act
      const result = await parseCssTricks(url);

      // Assert
      expect(result.source).toBe("css-tricks.com");
    });

    it("www.css-tricks.comドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_CSS_TRICKS_HTML),
      });
      const url = "https://www.css-tricks.com/a-complete-guide-to-flexbox/";

      // Act
      const result = await parseCssTricks(url);

      // Assert
      expect(result.source).toBe("www.css-tricks.com");
    });
  });

  describe("正常系", () => {
    it("記事のタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_CSS_TRICKS_HTML),
      });
      const url = "https://css-tricks.com/a-complete-guide-to-flexbox/";

      // Act
      const result = await parseCssTricks(url);

      // Assert
      expect(result.title).toBe("A Complete Guide to Flexbox");
    });

    it("記事本文をMarkdown形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_CSS_TRICKS_HTML),
      });
      const url = "https://css-tricks.com/a-complete-guide-to-flexbox/";

      // Act
      const result = await parseCssTricks(url);

      // Assert
      expect(result.content).toContain("Flexbox");
    });

    it("OGPメタタグからサムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_CSS_TRICKS_HTML),
      });
      const url = "https://css-tricks.com/a-complete-guide-to-flexbox/";

      // Act
      const result = await parseCssTricks(url);

      // Assert
      expect(result.thumbnailUrl).toBe(
        "https://css-tricks.com/wp-content/uploads/2024/03/flexbox-guide.png",
      );
    });

    it("metaタグから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_CSS_TRICKS_HTML),
      });
      const url = "https://css-tricks.com/a-complete-guide-to-flexbox/";

      // Act
      const result = await parseCssTricks(url);

      // Assert
      expect(result.author).toBe("CSS-Tricksテスト著者");
    });

    it("公開日をISO 8601形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_CSS_TRICKS_HTML),
      });
      const url = "https://css-tricks.com/a-complete-guide-to-flexbox/";

      // Act
      const result = await parseCssTricks(url);

      // Assert
      expect(result.publishedAt).toBe("2024-05-10T08:30:00.000Z");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_CSS_TRICKS_HTML),
      });
      const url = "https://css-tricks.com/a-complete-guide-to-flexbox/";

      // Act
      const result = await parseCssTricks(url);

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
      const url = "https://css-tricks.com/minimal-article/";

      // Act
      const result = await parseCssTricks(url);

      // Assert
      expect(result.title).toBe("最小限のCSS-Tricks記事");
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
      const url = "https://css-tricks.com/not-found/";

      // Act & Assert
      await expect(parseCssTricks(url)).rejects.toThrow("CSS-Tricks記事の取得に失敗しました");
    });

    it("本文が抽出できない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_CONTENT_HTML),
      });
      const url = "https://css-tricks.com/empty/";

      // Act & Assert
      await expect(parseCssTricks(url)).rejects.toThrow("CSS-Tricks記事の本文の抽出に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://css-tricks.com/error/";

      // Act & Assert
      await expect(parseCssTricks(url)).rejects.toThrow();
    });
  });

  describe("fetchリクエスト", () => {
    it("User-Agentヘッダーを送信すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_CSS_TRICKS_HTML),
      });
      const url = "https://css-tricks.com/a-complete-guide-to-flexbox/";

      // Act
      await parseCssTricks(url);

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
