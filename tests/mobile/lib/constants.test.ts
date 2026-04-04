import {
  APP_SCHEME,
  DARK_COLORS,
  getApiBaseUrl,
  IMAGE_SIZES,
  MAX_FREE_AI_USES,
  PAGINATION_LIMIT,
  STALE_TIME_MS,
  SUPPORTED_SOURCE_COUNT,
  SUPPORTED_SOURCES,
  THEME_COLORS,
} from "@/lib/constants";
import { SOURCE_DEFINITIONS } from "@/lib/sources";

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
    it("source定義と一致していること", () => {
      expect(SUPPORTED_SOURCES).toEqual(SOURCE_DEFINITIONS.map(({ id }) => id));
      expect(SUPPORTED_SOURCES).toHaveLength(SUPPORTED_SOURCE_COUNT);
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

  describe("DARK_COLORS", () => {
    it("ダークテーマカラートークンが定義されていること", () => {
      expect(DARK_COLORS.background).toBe("#0a0a0f");
      expect(DARK_COLORS.surface).toBe("#13131a");
      expect(DARK_COLORS.card).toBe("#1a1a2e");
      expect(DARK_COLORS.border).toBe("#2d2d44");
      expect(DARK_COLORS.primary).toBe("#6366f1");
      expect(DARK_COLORS.accent).toBe("#14b8a6");
      expect(DARK_COLORS.primaryLight).toBe("#818cf8");
      expect(DARK_COLORS.text).toBe("#e2e8f0");
      expect(DARK_COLORS.textMuted).toBe("#94a3b8");
      expect(DARK_COLORS.textDim).toBe("#64748b");
      expect(DARK_COLORS.white).toBe("#ffffff");
      expect(DARK_COLORS.error).toBe("#ef4444");
      expect(DARK_COLORS.success).toBe("#22c55e");
      expect(DARK_COLORS.warning).toBe("#f59e0b");
      expect(DARK_COLORS.info).toBe("#3b82f6");
      expect(DARK_COLORS.dangerSurface).toBe("#2d1a1a");
      expect(DARK_COLORS.successSurface).toBe("#1a2e1a");
      expect(DARK_COLORS.neutral).toBe("#44403c");
    });
  });
});
