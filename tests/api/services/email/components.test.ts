import { button, card, divider, muted, spacer } from "@api/services/email/components";
import { describe, expect, it } from "vitest";

describe("button", () => {
  describe("正常系", () => {
    it("ボタンテキストが HTML に含まれること", () => {
      // Arrange & Act
      const html = button({ text: "ログインする", href: "https://example.com/login" });

      // Assert
      expect(html).toContain("ログインする");
    });

    it("href が <a> タグに設定されること", () => {
      // Arrange & Act
      const html = button({ text: "確認する", href: "https://techclip.app/verify" });

      // Assert
      expect(html).toContain('href="https://techclip.app/verify"');
    });

    it("target=_blank が設定されること", () => {
      // Arrange & Act
      const html = button({ text: "開く", href: "https://example.com" });

      // Assert
      expect(html).toContain('target="_blank"');
    });

    it("table ベースの構造を生成すること（Outlook 互換）", () => {
      // Arrange & Act
      const html = button({ text: "ボタン", href: "https://example.com" });

      // Assert
      expect(html).toContain("<table");
      expect(html).toContain("</table>");
      expect(html).toContain("<tr>");
      expect(html).toContain("<td");
    });

    it("プライマリカラーの背景色が設定されること", () => {
      // Arrange & Act
      const html = button({ text: "送信", href: "https://example.com" });

      // Assert
      expect(html).toContain("#14b8a6");
    });

    it("Outlook VML フォールバックが含まれること", () => {
      // Arrange & Act
      const html = button({ text: "送信", href: "https://example.com" });

      // Assert
      expect(html).toContain("[if mso]");
      expect(html).toContain("v:roundrect");
    });

    it("空文字のテキストでも HTML を生成できること", () => {
      // Arrange & Act
      const html = button({ text: "", href: "https://example.com" });

      // Assert
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
    });
  });
});

describe("card", () => {
  describe("正常系", () => {
    it("タイトルが HTML に含まれること", () => {
      // Arrange & Act
      const html = card({ title: "記事タイトル", body: "本文テキスト" });

      // Assert
      expect(html).toContain("記事タイトル");
    });

    it("本文が HTML に含まれること", () => {
      // Arrange & Act
      const html = card({ title: "タイトル", body: "本文テキスト" });

      // Assert
      expect(html).toContain("本文テキスト");
    });

    it("table ベースの構造を生成すること", () => {
      // Arrange & Act
      const html = card({ title: "タイトル", body: "本文" });

      // Assert
      expect(html).toContain("<table");
      expect(html).toContain("</table>");
    });

    it("プライマリカラーの左ボーダーが設定されること", () => {
      // Arrange & Act
      const html = card({ title: "タイトル", body: "本文" });

      // Assert
      expect(html).toContain("#14b8a6");
      expect(html).toContain("border-left");
    });

    it("body に HTML タグが含まれる場合はそのまま出力されること", () => {
      // Arrange & Act
      const html = card({ title: "タイトル", body: "<strong>太字テキスト</strong>" });

      // Assert
      expect(html).toContain("<strong>太字テキスト</strong>");
    });
  });
});

describe("divider", () => {
  describe("正常系", () => {
    it("table ベースの区切り線を生成すること", () => {
      // Arrange & Act
      const html = divider();

      // Assert
      expect(html).toContain("<table");
      expect(html).toContain("</table>");
    });

    it("ボーダーカラーの背景色を持つ 1px 高のセルを生成すること", () => {
      // Arrange & Act
      const html = divider();

      // Assert
      expect(html).toContain('height="1"');
      expect(html).toContain("#e7e5e4");
    });

    it("文字列を返すこと", () => {
      // Arrange & Act
      const html = divider();

      // Assert
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
    });
  });
});

describe("muted", () => {
  describe("正常系", () => {
    it("テキストが HTML に含まれること", () => {
      // Arrange & Act
      const html = muted({ text: "補足テキスト" });

      // Assert
      expect(html).toContain("補足テキスト");
    });

    it("<p> タグで囲まれること", () => {
      // Arrange & Act
      const html = muted({ text: "テキスト" });

      // Assert
      expect(html).toContain("<p ");
      expect(html).toContain("</p>");
    });

    it("ミュートカラーのスタイルが適用されること", () => {
      // Arrange & Act
      const html = muted({ text: "テキスト" });

      // Assert
      expect(html).toContain("#78716c");
    });
  });
});

describe("spacer", () => {
  describe("正常系", () => {
    it("指定した高さの table を生成すること", () => {
      // Arrange & Act
      const html = spacer({ height: 24 });

      // Assert
      expect(html).toContain('height="24"');
    });

    it("table ベースの構造を生成すること", () => {
      // Arrange & Act
      const html = spacer({ height: 16 });

      // Assert
      expect(html).toContain("<table");
      expect(html).toContain("</table>");
    });

    it("height=0 でも HTML を生成できること", () => {
      // Arrange & Act
      const html = spacer({ height: 0 });

      // Assert
      expect(typeof html).toBe("string");
      expect(html).toContain('height="0"');
    });

    it("大きな高さ値でも正しく生成できること", () => {
      // Arrange & Act
      const html = spacer({ height: 100 });

      // Assert
      expect(html).toContain('height="100"');
    });
  });
});
