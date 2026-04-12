/**
 * 英語ロケール整合性テスト
 *
 * en.json のキーが ja.json と一致することを確認し、
 * 未翻訳キーや余剰キーを検出する。
 */
import enTranslations from "../../../apps/mobile/src/locales/en.json";
import jaTranslations from "../../../apps/mobile/src/locales/ja.json";

/**
 * ネストされたオブジェクトからドット区切りキーを抽出する
 */
function extractKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...extractKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe("i18n / 英語ロケール整合性", () => {
  const jaKeys = extractKeys(jaTranslations as unknown as Record<string, unknown>);
  const enKeys = extractKeys(enTranslations as unknown as Record<string, unknown>);

  it("ja.json と en.json のキー数が一致すること", () => {
    // Arrange & Act
    const jaSorted = [...jaKeys].sort();
    const enSorted = [...enKeys].sort();

    // Assert
    expect(enKeys.length).toBe(jaKeys.length);
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
    // Arrange
    function extractValues(
      obj: Record<string, unknown>,
      prefix = "",
    ): Array<{ key: string; value: unknown }> {
      const result: Array<{ key: string; value: unknown }> = [];
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          result.push(...extractValues(v as Record<string, unknown>, fullKey));
        } else {
          result.push({ key: fullKey, value: v });
        }
      }
      return result;
    }

    // Act
    const emptyValues = extractValues(enTranslations as unknown as Record<string, unknown>).filter(
      ({ value }) => typeof value === "string" && value.trim() === "",
    );

    // Assert
    expect(emptyValues).toHaveLength(0);
  });
});
