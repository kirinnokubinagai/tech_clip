import { detectSource } from "@api/services/source-detector";
import { describe, expect, it } from "vitest";

describe("detectSource", () => {
  describe("Zenn", () => {
    it("zenn.dev の記事URLを判定できること", () => {
      // Arrange
      const url = "https://zenn.dev/user/articles/example-article";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("zenn");
    });

    it("zenn.dev のブックURLを判定できること", () => {
      // Arrange
      const url = "https://zenn.dev/user/books/example-book";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("zenn");
    });
  });

  describe("Qiita", () => {
    it("qiita.com の記事URLを判定できること", () => {
      // Arrange
      const url = "https://qiita.com/user/items/abc123";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("qiita");
    });
  });

  describe("note", () => {
    it("note.com の記事URLを判定できること", () => {
      // Arrange
      const url = "https://note.com/user/n/nxxxxxxx";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("note");
    });
  });

  describe("はてなブログ", () => {
    it("hatenablog.com のURLを判定できること", () => {
      // Arrange
      const url = "https://example.hatenablog.com/entry/2024/01/01/title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("hatena");
    });

    it("hatenablog.jp のURLを判定できること", () => {
      // Arrange
      const url = "https://example.hatenablog.jp/entry/2024/01/01/title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("hatena");
    });

    it("hateblo.jp のURLを判定できること", () => {
      // Arrange
      const url = "https://example.hateblo.jp/entry/2024/01/01/title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("hatena");
    });
  });

  describe("SpeakerDeck", () => {
    it("speakerdeck.com のURLを判定できること", () => {
      // Arrange
      const url = "https://speakerdeck.com/user/presentation-title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("speakerdeck");
    });
  });

  describe("Dev.to", () => {
    it("dev.to の記事URLを判定できること", () => {
      // Arrange
      const url = "https://dev.to/user/article-title-abc1";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("devto");
    });
  });

  describe("Medium", () => {
    it("medium.com のURLを判定できること", () => {
      // Arrange
      const url = "https://medium.com/@user/article-title-abc123";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("medium");
    });

    it("サブドメイン付きmedium.com のURLを判定できること", () => {
      // Arrange
      const url = "https://blog.medium.com/article-title-abc123";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("medium");
    });
  });

  describe("Hacker News", () => {
    it("news.ycombinator.com のURLを判定できること", () => {
      // Arrange
      const url = "https://news.ycombinator.com/item?id=12345678";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("hackernews");
    });
  });

  describe("Hashnode", () => {
    it("hashnode.com のURLを判定できること", () => {
      // Arrange
      const url = "https://hashnode.com/post/article-title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("hashnode");
    });

    it("hashnode.dev のサブドメインURLを判定できること", () => {
      // Arrange
      const url = "https://user.hashnode.dev/article-title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("hashnode");
    });
  });

  describe("GitHub", () => {
    it("github.com のURLを判定できること", () => {
      // Arrange
      const url = "https://github.com/user/repo";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("github");
    });
  });

  describe("Stack Overflow", () => {
    it("stackoverflow.com のURLを判定できること", () => {
      // Arrange
      const url = "https://stackoverflow.com/questions/12345/title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("stackoverflow");
    });
  });

  describe("Reddit", () => {
    it("reddit.com のURLを判定できること", () => {
      // Arrange
      const url = "https://www.reddit.com/r/programming/comments/abc123/title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("reddit");
    });

    it("old.reddit.com のURLを判定できること", () => {
      // Arrange
      const url = "https://old.reddit.com/r/programming/comments/abc123/title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("reddit");
    });
  });

  describe("freeCodeCamp", () => {
    it("freecodecamp.org のURLを判定できること", () => {
      // Arrange
      const url = "https://www.freecodecamp.org/news/article-title";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("freecodecamp");
    });
  });

  describe("LogRocket", () => {
    it("blog.logrocket.com のURLを判定できること", () => {
      // Arrange
      const url = "https://blog.logrocket.com/article-title/";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("logrocket");
    });
  });

  describe("CSS-Tricks", () => {
    it("css-tricks.com のURLを判定できること", () => {
      // Arrange
      const url = "https://css-tricks.com/article-title/";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("css-tricks");
    });
  });

  describe("Smashing Magazine", () => {
    it("smashingmagazine.com のURLを判定できること", () => {
      // Arrange
      const url = "https://www.smashingmagazine.com/2024/01/article-title/";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("smashing");
    });
  });

  describe("YouTube", () => {
    it("www.youtube.com のURLを判定できること", () => {
      // Arrange
      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("youtube");
    });

    it("youtube.com（wwwなし）のURLを判定できること", () => {
      // Arrange
      const url = "https://youtube.com/watch?v=dQw4w9WgXcQ";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("youtube");
    });

    it("youtu.be の短縮URLを判定できること", () => {
      // Arrange
      const url = "https://youtu.be/dQw4w9WgXcQ";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("youtube");
    });
  });

  describe("その他", () => {
    it("未知のドメインの場合otherを返すこと", () => {
      // Arrange
      const url = "https://example.com/article";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("other");
    });

    it("個人ブログのURLの場合otherを返すこと", () => {
      // Arrange
      const url = "https://blog.personal-site.com/posts/my-article";

      // Act
      const result = detectSource(url);

      // Assert
      expect(result).toBe("other");
    });
  });
});
