import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseNote } from "../../../../apps/api/src/services/parsers/note";

/** note.com記事の標準的なHTML */
const SAMPLE_NOTE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>TypeScriptで始めるWebアプリ開発｜テスト著者</title>
  <meta property="og:title" content="TypeScriptで始めるWebアプリ開発" />
  <meta property="og:image" content="https://assets.st-note.com/production/uploads/images/12345/thumb.jpg" />
  <meta property="og:site_name" content="note" />
  <meta name="note:creator" content="testuser" />
  <meta property="article:published_time" content="2024-08-10T09:00:00+09:00" />
  <meta property="article:author" content="テスト著者" />
</head>
<body>
  <article>
    <h1>TypeScriptで始めるWebアプリ開発</h1>
    <div class="note-common-styles__textnote-body">
      <p>TypeScriptは型安全なJavaScriptのスーパーセットです。</p>
      <p>この記事では、TypeScriptを使ったWebアプリ開発の基本を解説します。</p>
      <h2>環境構築</h2>
      <p>まずはNode.jsをインストールしましょう。npmを使ってTypeScriptをインストールします。</p>
      <pre><code>npm install -g typescript</code></pre>
      <h2>基本的な型</h2>
      <p>TypeScriptにはstring、number、booleanなどの基本型があります。</p>
      <p>型注釈を使うことで、コンパイル時にエラーを検出できます。</p>
      <p>最後までお読みいただきありがとうございました。</p>
    </div>
  </article>
</body>
</html>
`;

/** OGPメタタグが最小限のHTML */
const MINIMAL_NOTE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>シンプルな記事｜著者名</title>
  <meta property="og:title" content="シンプルな記事" />
</head>
<body>
  <article>
    <h1>シンプルな記事</h1>
    <div class="note-common-styles__textnote-body">
      <p>メタ情報が最小限の記事です。</p>
      <p>OG画像や著者情報がない場合のテストです。</p>
      <p>Readabilityが認識できるように複数の段落を用意します。</p>
      <p>段落を追加してコンテンツ量を確保します。</p>
      <p>最後の段落です。パーサーのテストに使用します。</p>
    </div>
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

/** note:creatorメタタグで著者を取得するHTML */
const NOTE_CREATOR_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>クリエイター記事｜creator_user</title>
  <meta property="og:title" content="クリエイター記事" />
  <meta property="og:image" content="https://assets.st-note.com/img/thumb.png" />
  <meta name="note:creator" content="creator_user" />
</head>
<body>
  <article>
    <h1>クリエイター記事</h1>
    <div class="note-common-styles__textnote-body">
      <p>note:creatorメタタグから著者名を取得するテストです。</p>
      <p>article:authorが存在しない場合、note:creatorにフォールバックします。</p>
      <p>段落を追加してコンテンツ量を確保します。</p>
      <p>Readabilityが認識できるようにします。</p>
      <p>最後の段落です。</p>
    </div>
  </article>
</body>
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

describe("parseNote", () => {
  describe("URL検証", () => {
    it("note.com以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseNote(url)).rejects.toThrow("note.comのURLではありません");
    });

    it("記事パスを含まないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://note.com/";

      // Act & Assert
      await expect(parseNote(url)).rejects.toThrow("note.com記事のURLではありません");
    });

    it("ユーザーページのみのURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://note.com/testuser";

      // Act & Assert
      await expect(parseNote(url)).rejects.toThrow("note.com記事のURLではありません");
    });
  });

  describe("正常系", () => {
    it("note.com記事のタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.title).toBe("TypeScriptで始めるWebアプリ開発");
    });

    it("本文をMarkdownに変換できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.content).toContain("TypeScriptは型安全なJavaScript");
    });

    it("OG画像URLをthumbnailUrlに設定できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.thumbnailUrl).toBe(
        "https://assets.st-note.com/production/uploads/images/12345/thumb.jpg",
      );
    });

    it("article:authorから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.author).toBe("テスト著者");
    });

    it("公開日をISO 8601形式で取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.publishedAt).toBe("2024-08-10T09:00:00+09:00");
    });

    it("sourceが'note.com'であること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.source).toBe("note.com");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("正しいURLにUser-Agent付きでリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      await parseNote(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://note.com/testuser/n/abc123",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("TechClipBot"),
          }),
        }),
      );
    });
  });

  describe("著者名フォールバック", () => {
    it("article:authorがない場合note:creatorから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(NOTE_CREATOR_HTML),
      });
      const url = "https://note.com/creator_user/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.author).toBe("creator_user");
    });
  });

  describe("OGPメタタグなし", () => {
    it("メタタグが最小限でも記事を抽出できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.title).toBe("シンプルな記事");
      expect(result.content).toContain("メタ情報が最小限の記事です");
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
      const url = "https://note.com/testuser/n/abc123";

      // Act & Assert
      await expect(parseNote(url)).rejects.toThrow("HTMLの取得に失敗しました");
    });

    it("本文が抽出できない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_CONTENT_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act & Assert
      await expect(parseNote(url)).rejects.toThrow("記事本文の抽出に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://note.com/testuser/n/abc123";

      // Act & Assert
      await expect(parseNote(url)).rejects.toThrow();
    });
  });

  describe("URL形式バリエーション", () => {
    it("末尾スラッシュ付きURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123/";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.title).toBe("TypeScriptで始めるWebアプリ開発");
    });

    it("クエリパラメータ付きURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123?ref=timeline";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.title).toBe("TypeScriptで始めるWebアプリ開発");
    });
  });

  describe("Markdown変換", () => {
    it("見出しがMarkdown形式で変換されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_NOTE_HTML),
      });
      const url = "https://note.com/testuser/n/abc123";

      // Act
      const result = await parseNote(url);

      // Assert
      expect(result.content).toContain("環境構築");
      expect(result.content).toContain("基本的な型");
    });
  });
});
