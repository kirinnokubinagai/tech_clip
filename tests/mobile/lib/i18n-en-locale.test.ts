/**
 * 英語ロケール整合性テスト
 *
 * en.json のキーが ja.json と一致することを確認し、
 * 未翻訳キーや余剰キーを検出する。
 */
import enTranslations from "../../../apps/mobile/src/locales/en.json";
import jaTranslations from "../../../apps/mobile/src/locales/ja.json";

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

describe("i18n / 英語ロケール整合性", () => {
  const jaEntries = extractLeafEntries(jaTranslations as unknown as Record<string, unknown>);
  const enEntries = extractLeafEntries(enTranslations as unknown as Record<string, unknown>);
  const jaKeys = jaEntries.map((e) => e.key);
  const enKeys = enEntries.map((e) => e.key);

  it("ja.json と en.json のキーセットが一致すること", () => {
    // Arrange
    const jaSorted = [...jaKeys].sort();
    const enSorted = [...enKeys].sort();

    // Act & Assert
    expect(enSorted).toEqual(jaSorted);
  });

  it("en.json に ja.json にないキーが存在しないこと", () => {
    // Arrange
    const jaKeySet = new Set(jaKeys);

    // Act
    const surplusKeys = enKeys.filter((k) => !jaKeySet.has(k));

    // Assert
    expect(surplusKeys).toHaveLength(0);
  });

  it("ja.json に en.json にないキーが存在しないこと（未翻訳キーの検出）", () => {
    // Arrange
    const enKeySet = new Set(enKeys);

    // Act
    const missingKeys = jaKeys.filter((k) => !enKeySet.has(k));

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
