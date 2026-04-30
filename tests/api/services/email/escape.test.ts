import { escapeHtml } from "@api/services/email/escape";
import { describe, expect, it } from "vitest";

describe("escapeHtml", () => {
  describe("正常系: 特殊文字のエスケープ", () => {
    it("& を &amp; にエスケープすること", () => {
      // Arrange & Act
      const result = escapeHtml("foo & bar");

      // Assert
      expect(result).toBe("foo &amp; bar");
    });

    it("< を &lt; にエスケープすること", () => {
      // Arrange & Act
      const result = escapeHtml("<script>");

      // Assert
      expect(result).toBe("&lt;script&gt;");
    });

    it("> を &gt; にエスケープすること", () => {
      // Arrange & Act
      const result = escapeHtml("3 > 2");

      // Assert
      expect(result).toBe("3 &gt; 2");
    });

    it('" を &quot; にエスケープすること', () => {
      // Arrange & Act
      const result = escapeHtml('say "hello"');

      // Assert
      expect(result).toBe("say &quot;hello&quot;");
    });

    it("' を &#039; にエスケープすること", () => {
      // Arrange & Act
      const result = escapeHtml("it's");

      // Assert
      expect(result).toBe("it&#039;s");
    });

    it("すべての特殊文字を一度にエスケープすること", () => {
      // Arrange & Act
      const result = escapeHtml(`<b class="x" id='y'>Tom & Jerry</b>`);

      // Assert
      expect(result).toBe(
        "&lt;b class=&quot;x&quot; id=&#039;y&#039;&gt;Tom &amp; Jerry&lt;/b&gt;",
      );
    });
  });

  describe("XSS 対策", () => {
    it("script タグをエスケープすること", () => {
      // Arrange & Act
      const result = escapeHtml('<script>alert("xss")</script>');

      // Assert
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("</script>");
      expect(result).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    });

    it("イベントハンドラ属性をエスケープすること", () => {
      // Arrange & Act
      const result = escapeHtml('<img src=x onerror="alert(1)">');

      // Assert
      expect(result).not.toContain("<img");
      expect(result).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    });
  });

  describe("エッジケース", () => {
    it("空文字列をそのまま返すこと", () => {
      // Arrange & Act
      const result = escapeHtml("");

      // Assert
      expect(result).toBe("");
    });

    it("特殊文字を含まない文字列をそのまま返すこと", () => {
      // Arrange & Act
      const result = escapeHtml("Hello, World!");

      // Assert
      expect(result).toBe("Hello, World!");
    });

    it("日本語文字列を変更せずに返すこと", () => {
      // Arrange & Act
      const result = escapeHtml("テストユーザー");

      // Assert
      expect(result).toBe("テストユーザー");
    });

    it("複数の & が連続している場合をエスケープすること", () => {
      // Arrange & Act
      const result = escapeHtml("a && b && c");

      // Assert
      expect(result).toBe("a &amp;&amp; b &amp;&amp; c");
    });

    it("既にエスケープされた文字列を二重エスケープすること（冪等性なし）", () => {
      // Arrange & Act
      const result = escapeHtml("&amp;");

      // Assert
      expect(result).toBe("&amp;amp;");
    });
  });
});
