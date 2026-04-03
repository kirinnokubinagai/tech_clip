import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseMedium } from "../../../../apps/api/src/services/parsers/medium";

/** Medium記事のHTMLテンプレート（medium.comドメイン） */
const SAMPLE_MEDIUM_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>TypeScriptで学ぶデザインパターン</title>
  <meta property="og:title" content="TypeScriptで学ぶデザインパターン" />
  <meta property="og:image" content="https://miro.medium.com/v2/resize:fit:1200/1*abc123.jpeg" />
  <meta property="article:author" content="https://medium.com/@testauthor" />
  <meta property="article:published_time" content="2024-08-10T12:00:00.000Z" />
  <meta name="author" content="テスト著者" />
</head>
<body>
  <article>
    <h1>TypeScriptで学ぶデザインパターン</h1>
    <p>デザインパターンはソフトウェア設計における再利用可能な解決策です。</p>
    <p>この記事ではTypeScriptを使ってGoFのデザインパターンを解説します。</p>
    <h2>Singletonパターン</h2>
    <p>Singletonパターンはインスタンスが1つだけ存在することを保証するパターンです。</p>
    <pre><code>class Singleton {
  private static instance: Singleton;
  private constructor() {}
  static getInstance(): Singleton {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton();
    }
    return Singleton.instance;
  }
}</code></pre>
    <p>このパターンはグローバルな状態管理に使われます。</p>
    <p>ただし、テストが難しくなるデメリットもあります。</p>
  </article>
</body>
</html>
`;

/** カスタムドメインのMedium記事HTML */
const CUSTOM_DOMAIN_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>カスタムドメインの記事</title>
  <meta property="og:title" content="カスタムドメインの記事" />
  <meta property="og:image" content="https://miro.medium.com/v2/resize:fit:800/custom-thumb.png" />
  <meta property="article:published_time" content="2024-09-01T08:00:00.000Z" />
  <meta name="author" content="カスタム著者" />
</head>
<body>
  <article>
    <h1>カスタムドメインの記事</h1>
    <p>Mediumのカスタムドメイン機能を使って公開された記事です。</p>
    <p>独自ドメインでもMediumのプラットフォームを利用できます。</p>
    <p>この機能により、ブランドの一貫性を保ちながら記事を公開できます。</p>
    <p>多くの企業ブログがこの機能を活用しています。</p>
    <p>SEO対策にも効果的です。</p>
  </article>
</body>
</html>
`;

/** OGPメタタグなしのHTML */
const MINIMAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>最小限のMedium記事</title>
</head>
<body>
  <article>
    <h1>最小限のMedium記事</h1>
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

describe("parseMedium", () => {
  describe("正常系", () => {
    it("medium.comの記事からタイトル・本文・ソースを抽出できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_MEDIUM_HTML),
      });
      const url = "https://medium.com/@testauthor/typescript-design-patterns-abc123";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.title).toBe("TypeScriptで学ぶデザインパターン");
      expect(result.content).toContain("デザインパターン");
      expect(result.source).toBe("medium.com");
    });

    it("OGPメタタグからサムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_MEDIUM_HTML),
      });
      const url = "https://medium.com/@testauthor/article-abc123";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.thumbnailUrl).toBe("https://miro.medium.com/v2/resize:fit:1200/1*abc123.jpeg");
    });

    it("metaタグから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_MEDIUM_HTML),
      });
      const url = "https://medium.com/@testauthor/article-abc123";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.author).toBe("テスト著者");
    });

    it("OGPメタタグから公開日を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_MEDIUM_HTML),
      });
      const url = "https://medium.com/@testauthor/article-abc123";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.publishedAt).toBe("2024-08-10T12:00:00.000Z");
    });

    it("読了時間が計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_MEDIUM_HTML),
      });
      const url = "https://medium.com/@testauthor/article-abc123";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe("カスタムドメイン対応", () => {
    it("*.medium.comサブドメインの記事をパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(CUSTOM_DOMAIN_HTML),
      });
      const url = "https://blog.medium.com/custom-domain-article-xyz789";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.title).toBe("カスタムドメインの記事");
      expect(result.source).toBe("blog.medium.com");
    });

    it("カスタムドメインの記事をパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(CUSTOM_DOMAIN_HTML),
      });
      const url = "https://engineering.example.com/custom-article-123";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.title).toBe("カスタムドメインの記事");
      expect(result.source).toBe("engineering.example.com");
      expect(result.author).toBe("カスタム著者");
    });
  });

  describe("OGPメタタグなし", () => {
    it("メタタグがない場合でも記事を抽出できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_HTML),
      });
      const url = "https://medium.com/@testauthor/minimal-article-123";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.title).toBe("最小限のMedium記事");
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
      const url = "https://medium.com/@testauthor/not-found-article";

      // Act & Assert
      await expect(parseMedium(url)).rejects.toThrow("HTMLの取得に失敗しました");
    });

    it("本文が抽出できない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_CONTENT_HTML),
      });
      const url = "https://medium.com/@testauthor/empty-article";

      // Act & Assert
      await expect(parseMedium(url)).rejects.toThrow("記事本文の抽出に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://medium.com/@testauthor/error-article";

      // Act & Assert
      await expect(parseMedium(url)).rejects.toThrow();
    });
  });

  describe("Markdown変換", () => {
    it("コードブロックがMarkdown形式に変換されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_MEDIUM_HTML),
      });
      const url = "https://medium.com/@testauthor/article-abc123";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.content).toContain("Singleton");
      expect(result.content).toContain("getInstance");
    });

    it("見出しや強調がMarkdown形式に変換されること", async () => {
      // Arrange
      const htmlWithFormatting = `
<!DOCTYPE html>
<html>
<head><title>書式付きMedium記事</title></head>
<body>
  <article>
    <h1>書式付きMedium記事</h1>
    <h2>セクション1</h2>
    <p>通常のテキストと<strong>太字</strong>と<em>イタリック</em>があります。</p>
    <p>追加の段落です。Readabilityが認識できるようにします。</p>
    <p>さらに段落を追加します。テストの信頼性を高めます。</p>
    <ul>
      <li>リスト項目1</li>
      <li>リスト項目2</li>
    </ul>
    <p>最後の段落です。十分な量のコンテンツです。</p>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlWithFormatting),
      });
      const url = "https://medium.com/@testauthor/formatted-article";

      // Act
      const result = await parseMedium(url);

      // Assert
      expect(result.content).toContain("**太字**");
      expect(result.content).toContain("_イタリック_");
    });
  });

  describe("fetchリクエスト", () => {
    it("User-Agentヘッダーを送信すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_MEDIUM_HTML),
      });
      const url = "https://medium.com/@testauthor/article-abc123";

      // Act
      await parseMedium(url);

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
