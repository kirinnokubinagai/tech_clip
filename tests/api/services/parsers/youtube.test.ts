import { beforeEach, describe, expect, it, vi } from "vitest";

import { isYoutubeUrl, parseYoutube } from "../../../../apps/api/src/services/parsers/youtube";

describe("isYoutubeUrl", () => {
  it("youtube.com/watch URLを有効と判定すること", () => {
    const result = isYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toBe(true);
  });

  it("youtu.be短縮URLを有効と判定すること", () => {
    const result = isYoutubeUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toBe(true);
  });

  it("youtube.com/shorts URLを有効と判定すること", () => {
    const result = isYoutubeUrl("https://www.youtube.com/shorts/abcdef12345");
    expect(result).toBe(true);
  });

  it("他サイトのURLを無効と判定すること", () => {
    const result = isYoutubeUrl("https://example.com/watch?v=123");
    expect(result).toBe(false);
  });
});

describe("parseYoutube", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("oEmbed APIからメタデータを取得できること", async () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const mockResponse = {
      title: "テスト動画タイトル",
      author_name: "テストチャンネル",
      author_url: "https://www.youtube.com/@testchannel",
      thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await parseYoutube(url);

    expect(result.title).toBe("テスト動画タイトル");
    expect(result.author).toBe("テストチャンネル");
    expect(result.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(result.content).toBeNull();
  });

  it("不正なURLでエラーになること", async () => {
    await expect(parseYoutube("https://example.com")).rejects.toThrow("YouTubeのURLではありません");
  });

  it("oEmbed API失敗時にエラーになること", async () => {
    const url = "https://www.youtube.com/watch?v=invalid";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    await expect(parseYoutube(url)).rejects.toThrow("YouTube動画の取得に失敗しました");
  });
});
