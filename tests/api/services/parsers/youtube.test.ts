import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseYoutube } from "../../../../apps/api/src/services/parsers/youtube";

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

  it("oEmbed API失敗時にエラーになること", async () => {
    const url = "https://www.youtube.com/watch?v=invalid";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    await expect(parseYoutube(url)).rejects.toThrow("YouTube動画の取得に失敗しました");
  });

  it("thumbnail_urlが存在しない場合thumbnailUrlがnullになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const mockResponse = {
      title: "テスト動画タイトル",
      author_name: "テストチャンネル",
      author_url: "https://www.youtube.com/@testchannel",
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );
    const result = await parseYoutube(url);

    // Assert
    expect(result.thumbnailUrl).toBeNull();
  });

  it("titleが欠落しているレスポンスでエラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const mockResponse = {
      author_name: "テストチャンネル",
      author_url: "https://www.youtube.com/@testchannel",
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    // Assert
    await expect(parseYoutube(url)).rejects.toThrow();
  });

  it("author_nameが欠落しているレスポンスでエラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const mockResponse = {
      title: "テスト動画タイトル",
    };

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    // Assert
    await expect(parseYoutube(url)).rejects.toThrow();
  });

  it("空オブジェクトのレスポンスでエラーになること", async () => {
    // Arrange
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    // Act
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    // Assert
    await expect(parseYoutube(url)).rejects.toThrow();
  });
});
