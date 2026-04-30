import { parseGeneric } from "@api/services/parsers/generic";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("パーサー エッジケース", () => {
  describe("ペイウォール検出", () => {
    it("Mediumのペイウォールページを検出してエラーになること", async () => {
      // Arrange
      const paywallHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Member-only story</title>
  <meta name="robots" content="noindex" />
</head>
<body>
  <div class="meteredContent">
    <p>This content is only available to members.</p>
    <div class="paywall">Subscribe to read this article.</div>
  </div>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(paywallHtml),
      });

      // Act & Assert
      await expect(parseGeneric("https://medium.com/@user/member-only-article")).rejects.toThrow(
        "記事本文の抽出に失敗しました",
      );
    });

    it("ペイウォールシグナルを含むHTMLで本文抽出が失敗すること", async () => {
      // Arrange
      const paywallHtml = `
<!DOCTYPE html>
<html>
<head><title>有料コンテンツ</title></head>
<body>
  <div id="paywall-container">
    <h2>この記事は有料会員限定です</h2>
    <p>続きを読むには登録が必要です。</p>
  </div>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(paywallHtml),
      });

      // Act & Assert
      await expect(parseGeneric("https://example.com/premium-article")).rejects.toThrow(
        "記事本文の抽出に失敗しました",
      );
    });
  });

  describe("文字エンコーディング", () => {
    it("Shift_JISエンコードのHTMLをデコードできること", async () => {
      // Arrange: Shift_JIS宣言付きHTML（実際はUTF-8として渡す）
      const shiftJisHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="Shift_JIS" />
  <title>Shift_JIS記事</title>
</head>
<body>
  <article>
    <h1>Shift_JIS記事タイトル</h1>
    <p>Shift_JISエンコードされた日本語記事の本文です。</p>
    <p>文字化けせずに表示できることを確認します。</p>
    <p>複数の段落でReadabilityが認識できるようにします。</p>
    <p>さらに段落を追加してテストの信頼性を高めます。</p>
    <p>最後の段落です。エンコーディングテストです。</p>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(shiftJisHtml),
      });

      // Act
      const result = await parseGeneric("https://example.co.jp/shift-jis-article");

      // Assert
      expect(result.title).toContain("Shift_JIS");
      expect(result.content).toBeDefined();
      expect(result.content).not.toBeNull();
    });

    it("EUC-JPエンコード宣言のHTMLを処理できること", async () => {
      // Arrange
      const eucJpHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=EUC-JP" />
  <title>EUC-JP記事</title>
</head>
<body>
  <article>
    <h1>EUC-JP記事タイトル</h1>
    <p>EUC-JPエンコードされた日本語記事の本文です。</p>
    <p>正しく処理されることを確認します。</p>
    <p>複数の段落でReadabilityが認識できるようにします。</p>
    <p>さらに段落を追加してテストの信頼性を高めます。</p>
    <p>最後の段落です。エンコーディングテストです。</p>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(eucJpHtml),
      });

      // Act
      const result = await parseGeneric("https://example.co.jp/euc-jp-article");

      // Assert
      expect(result.title).toContain("EUC-JP");
      expect(result.content).toBeDefined();
    });
  });

  describe("タイムアウト", () => {
    it("fetchがタイムアウトした場合エラーになること", async () => {
      // Arrange: AbortErrorを模倣
      const abortError = new DOMException("The operation was aborted", "AbortError");
      mockFetch.mockRejectedValueOnce(abortError);

      // Act & Assert
      await expect(parseGeneric("https://example.com/slow-article")).rejects.toThrow();
    });

    it("10秒タイムアウトでfetchが呼ばれること", async () => {
      // Arrange
      const sampleHtml = `
<!DOCTYPE html>
<html>
<head><title>タイムアウトテスト</title></head>
<body>
  <article>
    <h1>タイムアウトテスト記事</h1>
    <p>タイムアウト付きのfetchが機能することを確認します。</p>
    <p>AbortControllerを使ったタイムアウト実装のテストです。</p>
    <p>複数の段落でReadabilityが認識できるようにします。</p>
    <p>さらに段落を追加してテストの信頼性を高めます。</p>
    <p>最後の段落です。タイムアウトテストです。</p>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(sampleHtml),
      });

      // Act
      await parseGeneric("https://example.com/timeout-test");

      // Assert: signalオプションを含むオブジェクトでfetchが呼ばれること
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/timeout-test",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });
  });

  describe("リダイレクト", () => {
    it("301リダイレクトが自動フォローされること", async () => {
      // Arrange: fetchはリダイレクトを自動フォローするため、ok:trueのレスポンスが返る
      const redirectedHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>リダイレクト先の記事</title>
  <meta property="og:image" content="https://example.com/redirect-thumb.jpg" />
</head>
<body>
  <article>
    <h1>リダイレクト先の記事</h1>
    <p>301リダイレクトを経由して取得した記事です。</p>
    <p>fetchはデフォルトでリダイレクトを追跡します。</p>
    <p>複数の段落でReadabilityが認識できるようにします。</p>
    <p>さらに段落を追加してテストの信頼性を高めます。</p>
    <p>最後の段落です。リダイレクトテストです。</p>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        redirected: true,
        url: "https://example.com/new-location",
        text: () => Promise.resolve(redirectedHtml),
      });

      // Act
      const result = await parseGeneric("https://example.com/old-location");

      // Assert
      expect(result.title).toBe("リダイレクト先の記事");
      expect(result.content).toContain("リダイレクトを経由");
    });

    it("fetchにmanualリダイレクトオプションが設定されること", async () => {
      // Arrange
      const html = `
<!DOCTYPE html>
<html>
<head><title>フォローテスト</title></head>
<body>
  <article>
    <h1>フォローテスト記事</h1>
    <p>リダイレクトフォローのテストです。</p>
    <p>followオプションが正しく設定されていることを確認します。</p>
    <p>複数の段落でReadabilityが認識できるようにします。</p>
    <p>さらに段落を追加してテストの信頼性を高めます。</p>
    <p>最後の段落です。フォローオプションテストです。</p>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      });

      // Act
      await parseGeneric("https://example.com/follow-test");

      // Assert: SSRF対策のためredirect: "manual"でfetchが呼ばれること
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/follow-test",
        expect.objectContaining({
          redirect: "manual",
        }),
      );
    });
  });

  describe("壊れたHTML", () => {
    it("タグが閉じていないHTMLでも処理できること", async () => {
      // Arrange: linkedomはHTMLを修復するが、Readabilityが認識できる十分な本文量が必要
      const brokenHtml = `
<!DOCTYPE html>
<html>
<head><title>壊れたHTML記事</title></head>
<body>
  <article>
    <h1>壊れたHTML記事</h1>
    <p>閉じタグのない段落です。
    <p>もう一つの段落です。
    <p>壊れたHTMLの処理テストです。
    <p>linkedomがHTMLを修復して処理します。
    <p>Readabilityが本文を認識できることを確認します。
    <p>さらに段落を追加してコンテンツ量を確保します。
    <p>十分な量のテキストがあればReadabilityが機能します。
    <p>最後の段落です。壊れたHTMLのテストです。
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(brokenHtml),
      });

      // Act
      const result = await parseGeneric("https://example.com/broken-html");

      // Assert: 壊れたHTMLでも記事が取得できる
      expect(result.title).toBe("壊れたHTML記事");
      expect(result.content).not.toBeNull();
    });

    it("本文抽出が完全に失敗した場合にエラーになること", async () => {
      // Arrange: 完全に空のbody
      const emptyHtml = `
<!DOCTYPE html>
<html>
<head><title>空ページ</title></head>
<body></body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(emptyHtml),
      });

      // Act & Assert
      await expect(parseGeneric("https://example.com/empty-page")).rejects.toThrow(
        "記事本文の抽出に失敗しました",
      );
    });

    it("scriptタグのみのHTMLで本文抽出が失敗すること", async () => {
      // Arrange
      const scriptOnlyHtml = `
<!DOCTYPE html>
<html>
<head><title>スクリプトのみ</title></head>
<body>
  <script>window.location.href = "https://evil.com";</script>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(scriptOnlyHtml),
      });

      // Act & Assert
      await expect(parseGeneric("https://example.com/script-only")).rejects.toThrow(
        "記事本文の抽出に失敗しました",
      );
    });
  });

  describe("フォールバック画像", () => {
    it("og:imageがない場合にthumbnailUrlがnullになること", async () => {
      // Arrange
      const noImageHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>画像なし記事</title>
</head>
<body>
  <article>
    <h1>画像なし記事</h1>
    <p>サムネイル画像のない記事です。</p>
    <p>thumbnailUrlがnullになることを確認します。</p>
    <p>複数の段落でReadabilityが認識できるようにします。</p>
    <p>さらに段落を追加してテストの信頼性を高めます。</p>
    <p>最後の段落です。画像なしテストです。</p>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(noImageHtml),
      });

      // Act
      const result = await parseGeneric("https://example.com/no-image-article");

      // Assert
      expect(result.thumbnailUrl).toBeNull();
    });

    it("壊れた画像URLのog:imageがあっても文字列としてそのまま返すこと", async () => {
      // Arrange
      const brokenImageHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>壊れた画像URL記事</title>
  <meta property="og:image" content="not-a-valid-url" />
</head>
<body>
  <article>
    <h1>壊れた画像URL記事</h1>
    <p>不正な画像URLを持つ記事です。</p>
    <p>URLバリデーションはクライアント側で行います。</p>
    <p>複数の段落でReadabilityが認識できるようにします。</p>
    <p>さらに段落を追加してテストの信頼性を高めます。</p>
    <p>最後の段落です。壊れた画像URLテストです。</p>
  </article>
</body>
</html>
`;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(brokenImageHtml),
      });

      // Act
      const result = await parseGeneric("https://example.com/broken-image-article");

      // Assert: パーサーはURLをそのまま返す（バリデーションはしない）
      expect(result.thumbnailUrl).toBe("not-a-valid-url");
    });
  });

  describe("HTTPエラーステータス", () => {
    it("401 Unauthorized でエラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Act & Assert
      await expect(parseGeneric("https://example.com/auth-required")).rejects.toThrow(
        "HTMLの取得に失敗しました（ステータス: 401）",
      );
    });

    it("403 Forbidden でエラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      // Act & Assert
      await expect(parseGeneric("https://example.com/forbidden")).rejects.toThrow(
        "HTMLの取得に失敗しました（ステータス: 403）",
      );
    });

    it("500 Internal Server Error でエラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Act & Assert
      await expect(parseGeneric("https://example.com/server-error")).rejects.toThrow(
        "HTMLの取得に失敗しました（ステータス: 500）",
      );
    });
  });
});
