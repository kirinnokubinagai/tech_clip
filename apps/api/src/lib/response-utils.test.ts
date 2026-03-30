import { describe, expect, it } from "vitest";
import { omitContent } from "./response-utils";

describe("omitContent", () => {
  it("contentフィールドを除外した記事データを返すこと", () => {
    // Arrange
    const article: Record<string, unknown> = {
      id: "01ABCDEF",
      title: "テスト記事",
      content: "本文テキスト",
      excerpt: "抜粋",
    };

    // Act
    const result = omitContent(article);

    // Assert
    expect(result).toStrictEqual({
      id: "01ABCDEF",
      title: "テスト記事",
      excerpt: "抜粋",
    });
  });

  it("contentフィールドが存在しない場合でも他フィールドをそのまま返すこと", () => {
    // Arrange
    const article: Record<string, unknown> = {
      id: "01ABCDEF",
      title: "テスト記事",
      excerpt: "抜粋",
    };

    // Act
    const result = omitContent(article);

    // Assert
    expect(result).toStrictEqual({
      id: "01ABCDEF",
      title: "テスト記事",
      excerpt: "抜粋",
    });
  });

  it("contentのみのオブジェクトの場合は空オブジェクトを返すこと", () => {
    // Arrange
    const article: Record<string, unknown> = { content: "本文テキスト" };

    // Act
    const result = omitContent(article);

    // Assert
    expect(result).toStrictEqual({});
  });

  it("元のオブジェクトを変更しないこと", () => {
    // Arrange
    const article: Record<string, unknown> = {
      id: "01ABCDEF",
      content: "本文テキスト",
    };

    // Act
    omitContent(article);

    // Assert
    expect(article.content).toBe("本文テキスト");
  });
});
