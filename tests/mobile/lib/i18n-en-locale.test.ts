/**
 * 英語ロケール整合性テスト
 *
 * en.json のキーが ja.json と一致することを確認し、
 * 未翻訳キーや余剰キーを検出する。
 */
import enTranslations from "../../../apps/mobile/src/locales/en.json";
import jaTranslations from "../../../apps/mobile/src/locales/ja.json";

/**
 * i18next plural サフィックス（compatibilityJSON v4 形式 / CLDR 準拠）
 *
 * i18next v25 以降のデフォルト plural ルール。`_one` / `_other` などの
 * サフィックスが `count` の値に応じて自動解決される。
 */
const PLURAL_SUFFIXES = ["_one", "_other", "_zero", "_two", "_few", "_many"];

/**
 * ネストされたオブジェクトからリーフエントリ（キーと値のペア）を抽出する
 */
function extractLeafEntries(
  obj: Record<string, unknown>,
  prefix = "",
): Array<{ key: string; value: unknown }> {
  const result: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result.push(...extractLeafEntries(v as Record<string, unknown>, fullKey));
      continue;
    }
    result.push({ key: fullKey, value: v });
  }
  return result;
}

/**
 * plural サフィックスを除いたベースキーを返す。
 * サフィックスがなければキーをそのまま返す。
 */
function stripPluralSuffix(key: string): string {
  for (const suffix of PLURAL_SUFFIXES) {
    if (key.endsWith(suffix)) {
      return key.slice(0, -suffix.length);
    }
  }
  return key;
}

/**
 * キーセット比較時に plural サフィックスを正規化する。
 * `foo_one` / `foo_other` はどちらも `foo` として扱い、
 * 相手側に `foo` または `foo_one` / `foo_other` のいずれかがあれば一致とみなす。
 */
function normalizeKeys(keys: string[]): Set<string> {
  const normalized = new Set<string>();
  for (const key of keys) {
    normalized.add(stripPluralSuffix(key));
  }
  return normalized;
}

describe("i18n / 英語ロケール整合性", () => {
  const jaEntries = extractLeafEntries(jaTranslations as unknown as Record<string, unknown>);
  const enEntries = extractLeafEntries(enTranslations as unknown as Record<string, unknown>);
  const jaKeys = jaEntries.map((e) => e.key);
  const enKeys = enEntries.map((e) => e.key);

  it("ja.json と en.json のベースキーセットが一致すること", () => {
    // Arrange
    const jaNormalized = [...normalizeKeys(jaKeys)].sort();
    const enNormalized = [...normalizeKeys(enKeys)].sort();

    // Act & Assert
    expect(enNormalized).toEqual(jaNormalized);
  });

  it("en.json に ja.json にないベースキーが存在しないこと", () => {
    // Arrange
    const jaNormalizedSet = normalizeKeys(jaKeys);

    // Act
    const surplusKeys = enKeys.filter((k) => !jaNormalizedSet.has(stripPluralSuffix(k)));

    // Assert
    expect(surplusKeys).toHaveLength(0);
  });

  it("ja.json に en.json にないキーが存在しないこと（未翻訳キーの検出）", () => {
    // Arrange
    const enNormalizedSet = normalizeKeys(enKeys);

    // Act
    const missingKeys = jaKeys.filter((k) => !enNormalizedSet.has(stripPluralSuffix(k)));

    // Assert
    expect(missingKeys).toHaveLength(0);
  });

  it("en.json のすべてのキーが空文字でないこと", () => {
    // Act
    const emptyValues = enEntries.filter(
      ({ value }) => typeof value === "string" && value.trim() === "",
    );

    // Assert
    expect(emptyValues).toHaveLength(0);
  });
});
