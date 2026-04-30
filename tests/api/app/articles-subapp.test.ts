import { describe, expect, it } from "vitest";

/**
 * base64url エンコード
 *
 * @param obj - エンコードするオブジェクト
 * @returns base64url 文字列
 */
function encodeCursor(obj: { ts: string; id: string }): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * base64url デコード
 *
 * @param cursor - base64url 文字列
 * @returns デコードされたオブジェクト
 */
function decodeCursor(cursor: string): { ts: string; id: string } {
  const base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  return JSON.parse(atob(padded)) as { ts: string; id: string };
}

describe("cursor エンコード/デコード", () => {
  it("cursor encode/decode が復元できること", () => {
    // Arrange
    const original = { ts: "2026-04-20T10:00:00Z", id: "uuid-123" };

    // Act
    const encoded = encodeCursor(original);
    const decoded = decodeCursor(encoded);

    // Assert
    expect(decoded).toEqual(original);
  });

  it("エンコードされた cursor に URL 非安全文字が含まれないこと", () => {
    // Arrange
    const obj = { ts: "2026-04-20T10:00:00Z", id: "some-id-with-special" };

    // Act
    const encoded = encodeCursor(obj);

    // Assert
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("特殊文字を含む値でも正しく復元できること", () => {
    // Arrange
    const original = { ts: "2026-01-01T00:00:00.000Z", id: "01JABC+DEF/XYZ=" };

    // Act
    const encoded = encodeCursor(original);
    const decoded = decodeCursor(encoded);

    // Assert
    expect(decoded).toEqual(original);
    expect(encoded).not.toMatch(/[+/=]/);
  });
});
