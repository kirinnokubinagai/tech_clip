import { parseHatena } from "@api/services/parsers/hatena";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** はてなブログ記事のHTMLモック */
const SAMPLE_HATENA_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>TypeScriptで型安全なAPIクライアントを作る - テスト技術ブログ</title>
  <meta property="og:title" content="TypeScriptで型安全なAPIクライアントを作る" />
  <meta property="og:image" content="https://cdn-ak.f.st-hatena.com/images/fotolife/t/testuser/20240715/thumb.png" />
  <meta property="article:published_time" content="2024-07-15T10:00:00+09:00" />
  <meta name="author" content="testuser" />
</head>
<body>
  <article class="entry">
    <h1 class="entry-title">TypeScriptで型安全なAPIクライアントを作る</h1>
    <div class="entry-content">
      <p>TypeScriptの型システムを活用して、型安全なAPIクライアントを構築する方法を紹介します。</p>
      <h2>背景</h2>
      <p>REST APIを呼び出す際、レスポンスの型が保証されないことが問題になります。</p>
      <p>この記事では、zodとfetchを組み合わせたアプローチを解説します。</p>
      <h2>実装</h2>
      <p>まずはスキーマを定義します。</p>
      <pre><code>const UserSchema = z.object({ id: z.string(), name: z.string() });</code></pre>
      <p>次にフェッチ関数を作成します。型推論が自動的に効きます。</p>
      <p>最後にエラーハンドリングを追加して完成です。</p>
    </div>
  </article>
</body>
</html>
`;

/** OGPメタタグなしのはてなブログHTML */
const MINIMAL_HATENA_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>最小限の記事 - テストブログ</title>
</head>
<body>
  <article class="entry">
    <h1 class="entry-title">最小限の記事</h1>
    <div class="entry-content">
      <p>本文のみの記事です。メタ情報はありません。</p>
      <p>Readabilityが認識できるように複数の段落を用意します。</p>
      <p>段落を追加してコンテンツ量を確保します。</p>
      <p>さらに追加の段落でボリュームを増やします。</p>
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

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseHatena", () => {
  describe("URL検証", () => {
    it("hatenablog.com以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/entry/2024/07/15/100000";

      // Act & Assert
      await expect(parseHatena(url)).rejects.toThrow("はてなブログ");
    });

    it("hatenablog.comドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HATENA_HTML),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/100000";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.source).toBe("testuser.hatenablog.com");
    });

    it("hatenablog.jpドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HATENA_HTML),
      });
      const url = "https://testuser.hatenablog.jp/entry/2024/07/15/100000";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.source).toBe("testuser.hatenablog.jp");
    });

    it("hateblo.jpドメインを受け付けること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HATENA_HTML),
      });
      const url = "https://testuser.hateblo.jp/entry/2024/07/15/100000";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.source).toBe("testuser.hateblo.jp");
    });
  });

  describe("正常系", () => {
    it("HTMLから記事情報を抽出してMarkdownに変換できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HATENA_HTML),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/100000";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.title).toContain("TypeScript");
      expect(result.content).toContain("型安全なAPIクライアント");
    });

    it("OGPメタタグからサムネイルURLを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HATENA_HTML),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/100000";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.thumbnailUrl).toBe(
        "https://cdn-ak.f.st-hatena.com/images/fotolife/t/testuser/20240715/thumb.png",
      );
    });

    it("公開日を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HATENA_HTML),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/100000";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.publishedAt).toBe("2024-07-15T10:00:00+09:00");
    });

    it("著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HATENA_HTML),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/100000";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.author).toBe("testuser");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HATENA_HTML),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/100000";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("正しいURLにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_HATENA_HTML),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/100000";

      // Act
      await parseHatena(url);

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

  describe("OGPメタタグなし", () => {
    it("メタタグがない場合でも記事を抽出できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MINIMAL_HATENA_HTML),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/01/01/000000";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.title).toContain("最小限の記事");
      expect(result.content).toContain("本文のみの記事");
      expect(result.thumbnailUrl).toBeNull();
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
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/not-found";

      // Act & Assert
      await expect(parseHatena(url)).rejects.toThrow("取得に失敗しました");
    });

    it("本文が抽出できない場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(EMPTY_CONTENT_HTML),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/empty";

      // Act & Assert
      await expect(parseHatena(url)).rejects.toThrow("本文");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/100000";

      // Act & Assert
      await expect(parseHatena(url)).rejects.toThrow();
    });
  });

  describe("Markdown変換", () => {
    it("変換結果がMarkdown形式であること", async () => {
      // Arrange
      const htmlWithFormatting = `
<!DOCTYPE html>
<html>
<head><title>書式付き記事 - テストブログ</title></head>
<body>
  <article class="entry">
    <h1 class="entry-title">書式付き記事</h1>
    <div class="entry-content">
      <h2>セクション1</h2>
      <p>通常のテキストと<strong>太字</strong>と<em>イタリック</em>があります。</p>
      <p>追加の段落です。Readabilityが認識できるようにします。</p>
      <p>さらに段落を追加します。テストの信頼性を高めます。</p>
      <ul>
        <li>リスト項目1</li>
        <li>リスト項目2</li>
      </ul>
      <p>最後の段落です。十分な量のコンテンツです。</p>
    </div>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(htmlWithFormatting),
      });
      const url = "https://testuser.hatenablog.com/entry/2024/07/15/formatted";

      // Act
      const result = await parseHatena(url);

      // Assert
      expect(result.content).toContain("**太字**");
      expect(result.content).toContain("_イタリック_");
    });
  });
});
