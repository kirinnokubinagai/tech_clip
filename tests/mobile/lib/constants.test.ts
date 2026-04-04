import {
  APP_SCHEME,
  getApiBaseUrl,
  IMAGE_SIZES,
  MAX_FREE_AI_USES,
  PAGINATION_LIMIT,
  STALE_TIME_MS,
  SUPPORTED_SOURCES,
  THEME_COLORS,
  UI_COLORS,
} from "@/lib/constants";

describe("constants", () => {
  describe("getApiBaseUrl", () => {
    it("URLを返すこと", () => {
      // Act
      const url = getApiBaseUrl();

      // Assert
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);
    });
  });

  describe("APP_SCHEME", () => {
    it("techclipであること", () => {
      expect(APP_SCHEME).toBe("techclip");
    });
  });

  describe("MAX_FREE_AI_USES", () => {
    it("5であること", () => {
      expect(MAX_FREE_AI_USES).toBe(5);
    });
  });

  describe("SUPPORTED_SOURCES", () => {
    it("全ソースが定義されていること", () => {
      expect(SUPPORTED_SOURCES).toContain("zenn");
      expect(SUPPORTED_SOURCES).toContain("qiita");
      expect(SUPPORTED_SOURCES).toContain("note");
      expect(SUPPORTED_SOURCES).toContain("hatena");
      expect(SUPPORTED_SOURCES).toContain("devto");
      expect(SUPPORTED_SOURCES).toContain("medium");
      expect(SUPPORTED_SOURCES).toContain("hackernews");
      expect(SUPPORTED_SOURCES).toContain("hashnode");
      expect(SUPPORTED_SOURCES).toContain("github");
      expect(SUPPORTED_SOURCES).toContain("stackoverflow");
      expect(SUPPORTED_SOURCES).toContain("reddit");
      expect(SUPPORTED_SOURCES).toContain("speakerdeck");
      expect(SUPPORTED_SOURCES).toContain("freecodecamp");
      expect(SUPPORTED_SOURCES).toContain("logrocket");
      expect(SUPPORTED_SOURCES).toContain("css-tricks");
      expect(SUPPORTED_SOURCES).toContain("smashing");
      expect(SUPPORTED_SOURCES).toContain("other");
    });

    it("重複がないこと", () => {
      const unique = new Set(SUPPORTED_SOURCES);
      expect(unique.size).toBe(SUPPORTED_SOURCES.length);
    });
  });

  describe("PAGINATION_LIMIT", () => {
    it("20であること", () => {
      expect(PAGINATION_LIMIT).toBe(20);
    });
  });

  describe("STALE_TIME_MS", () => {
    it("5分（300000ミリ秒）であること", () => {
      expect(STALE_TIME_MS).toBe(5 * 60 * 1000);
    });
  });

  describe("IMAGE_SIZES", () => {
    it("thumbnail, avatar, fullが定義されていること", () => {
      expect(IMAGE_SIZES.thumbnail).toMatchObject({
        width: expect.any(Number),
        height: expect.any(Number),
      });
      expect(IMAGE_SIZES.avatar).toMatchObject({
        width: expect.any(Number),
        height: expect.any(Number),
      });
      expect(IMAGE_SIZES.full).toMatchObject({
        width: expect.any(Number),
        height: expect.any(Number),
      });
    });

    it("thumbnailがfullより小さいこと", () => {
      expect(IMAGE_SIZES.thumbnail.width).toBeLessThan(IMAGE_SIZES.full.width);
      expect(IMAGE_SIZES.thumbnail.height).toBeLessThan(IMAGE_SIZES.full.height);
    });
  });

  describe("THEME_COLORS", () => {
    it("必須カラーが定義されていること", () => {
      expect(THEME_COLORS.background).toBe("#fafaf9");
      expect(THEME_COLORS.card).toBe("#ffffff");
      expect(THEME_COLORS.text).toBe("#1c1917");
      expect(THEME_COLORS.accent).toBe("#14b8a6");
      expect(THEME_COLORS.border).toBe("#e7e5e4");
      expect(THEME_COLORS.error).toBe("#ef4444");
      expect(THEME_COLORS.success).toBe("#22c55e");
      expect(THEME_COLORS.warning).toBe("#f59e0b");
    });
  });

  describe("UI_COLORS", () => {
    it("共有UIトークンが定義されていること", () => {
      expect(UI_COLORS.background).toBe("#0a0a0f");
      expect(UI_COLORS.surface).toBe("#13131a");
      expect(UI_COLORS.card).toBe("#1a1a2e");
      expect(UI_COLORS.border).toBe("#2d2d44");
      expect(UI_COLORS.primary).toBe("#6366f1");
      expect(UI_COLORS.primaryLight).toBe("#818cf8");
      expect(UI_COLORS.text).toBe("#e2e8f0");
      expect(UI_COLORS.textMuted).toBe("#94a3b8");
      expect(UI_COLORS.textDim).toBe("#64748b");
      expect(UI_COLORS.white).toBe("#ffffff");
      expect(UI_COLORS.error).toBe("#ef4444");
      expect(UI_COLORS.success).toBe("#22c55e");
      expect(UI_COLORS.warning).toBe("#f59e0b");
      expect(UI_COLORS.info).toBe("#3b82f6");
      expect(UI_COLORS.dangerSurface).toBe("#2d1a1a");
      expect(UI_COLORS.successSurface).toBe("#1a2e1a");
      expect(UI_COLORS.neutral).toBe("#44403c");
    });
  });
});
