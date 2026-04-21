import { generateRefreshToken, hashTokenSha256 } from "@api/lib/token-utils";
import { describe, expect, it } from "vitest";

describe("hashTokenSha256", () => {
  it("同じ入力に対して同じ16進文字列を返すこと", async () => {
    // Arrange
    const token = "test-token-12345";

    // Act
    const hash1 = await hashTokenSha256(token);
    const hash2 = await hashTokenSha256(token);

    // Assert
    expect(hash1).toBe(hash2);
  });

  it("出力長が64文字（SHA-256 hex）であること", async () => {
    // Arrange
    const token = "any-token";

    // Act
    const hash = await hashTokenSha256(token);

    // Assert
    expect(hash).toHaveLength(64);
  });

  it("16進文字のみで構成されること", async () => {
    // Arrange
    const token = "some-token";

    // Act
    const hash = await hashTokenSha256(token);

    // Assert
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("generateRefreshToken", () => {
  it("48文字の16進文字列を返すこと", () => {
    // Act
    const token = generateRefreshToken();

    // Assert
    expect(token).toHaveLength(48);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("複数回呼んでも衝突しないこと（10回生成して全て異なること）", () => {
    // Arrange
    const tokens = new Set<string>();

    // Act
    for (let i = 0; i < 10; i++) {
      tokens.add(generateRefreshToken());
    }

    // Assert
    expect(tokens.size).toBe(10);
  });
});
