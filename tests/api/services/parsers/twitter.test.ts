import { describe, it, expect, vi, beforeEach } from "vitest";

import { parseTwitter, isTwitterUrl } from "../../../../apps/api/src/services/parsers/twitter";

describe("isTwitterUrl", () => {
  it("x.com の投稿URLを有効と判定すること", () => {
    const url = "https://x.com/testuser/status/1234567890";
    const result = isTwitterUrl(url);
    expect(result).toBe(true);
  });

  it("twitter.com の投稿URLを有効と判定すること", () => {
    const url = "https://twitter.com/testuser/status/9876543210";
    const result = isTwitterUrl(url);
    expect(result).toBe(true);
  });

  it("プロフィールURLを無効と判定すること", () => {
    const url = "https://x.com/testuser";
    const result = isTwitterUrl(url);
    expect(result).toBe(false);
  });

  it("他サイトのURLを無効と判定すること", () => {
    const url = "https://example.com/status/123";
    const result = isTwitterUrl(url);
    expect(result).toBe(false);
  });
});

describe("parseTwitter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("oEmbed APIからツイート本文を取得できること", async () => {
    const url = "https://x.com/testuser/status/1234567890";
    const mockResponse = {
      html: '<blockquote><p>テスト投稿の本文です</p>&mdash; テストユーザー (@testuser)</blockquote>',
      author_name: "テストユーザー",
      author_url: "https://x.com/testuser",
      url,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await parseTwitter(url);

    expect(result.title).toBe("テストユーザーのポスト");
    expect(result.author).toBe("テストユーザー");
    expect(result.content).toContain("テスト投稿の本文です");
    expect(result.readingTimeMinutes).toBe(1);
  });

  it("不正なURLでエラーになること", async () => {
    const url = "https://example.com/not-twitter";
    await expect(parseTwitter(url)).rejects.toThrow("Twitter/XのURLではありません");
  });

  it("oEmbed API失敗時にエラーになること", async () => {
    const url = "https://x.com/testuser/status/1234567890";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    );
    await expect(parseTwitter(url)).rejects.toThrow("ツイートの取得に失敗しました");
  });
});
