import { verifyGitHubWebhookSignature } from "@api/services/github-webhook-verifier";
import { describe, expect, it } from "vitest";

/** テスト用 HMAC-SHA256 署名を生成するヘルパー */
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, payloadData);
  const hex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256=${hex}`;
}

describe("verifyGitHubWebhookSignature", () => {
  describe("正常系", () => {
    it("正しい署名で検証が成功すること", async () => {
      // Arrange
      const payload = JSON.stringify({ action: "opened" });
      const secret = "test-secret-key";
      const signature = await generateSignature(payload, secret);

      // Act
      const result = await verifyGitHubWebhookSignature(payload, signature, secret);

      // Assert
      expect(result).toBe(true);
    });

    it("空のペイロードでも署名が一致すれば成功すること", async () => {
      // Arrange
      const payload = "";
      const secret = "test-secret-key";
      const signature = await generateSignature(payload, secret);

      // Act
      const result = await verifyGitHubWebhookSignature(payload, signature, secret);

      // Assert
      expect(result).toBe(true);
    });

    it("日本語を含むペイロードでも署名が一致すれば成功すること", async () => {
      // Arrange
      const payload = JSON.stringify({ body: "テストコメント" });
      const secret = "secret-with-special-chars-!@#";
      const signature = await generateSignature(payload, secret);

      // Act
      const result = await verifyGitHubWebhookSignature(payload, signature, secret);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe("異常系", () => {
    it("署名が間違っている場合は false を返すこと", async () => {
      // Arrange
      const payload = JSON.stringify({ action: "opened" });
      const secret = "test-secret-key";
      const wrongSignature =
        "sha256=0000000000000000000000000000000000000000000000000000000000000000";

      // Act
      const result = await verifyGitHubWebhookSignature(payload, wrongSignature, secret);

      // Assert
      expect(result).toBe(false);
    });

    it("sha256= プレフィックスがない署名は false を返すこと", async () => {
      // Arrange
      const payload = JSON.stringify({ action: "opened" });
      const secret = "test-secret-key";
      const invalidSignature = "no-prefix-signature";

      // Act
      const result = await verifyGitHubWebhookSignature(payload, invalidSignature, secret);

      // Assert
      expect(result).toBe(false);
    });

    it("シークレットが異なる場合は false を返すこと", async () => {
      // Arrange
      const payload = JSON.stringify({ action: "opened" });
      const secret = "correct-secret";
      const wrongSecret = "wrong-secret";
      const signature = await generateSignature(payload, secret);

      // Act
      const result = await verifyGitHubWebhookSignature(payload, signature, wrongSecret);

      // Assert
      expect(result).toBe(false);
    });

    it("ペイロードが改ざんされた場合は false を返すこと", async () => {
      // Arrange
      const originalPayload = JSON.stringify({ action: "opened" });
      const tamperedPayload = JSON.stringify({ action: "closed" });
      const secret = "test-secret-key";
      const signature = await generateSignature(originalPayload, secret);

      // Act
      const result = await verifyGitHubWebhookSignature(tamperedPayload, signature, secret);

      // Assert
      expect(result).toBe(false);
    });

    it("空の署名文字列は false を返すこと", async () => {
      // Arrange
      const payload = JSON.stringify({ action: "opened" });
      const secret = "test-secret-key";

      // Act
      const result = await verifyGitHubWebhookSignature(payload, "", secret);

      // Assert
      expect(result).toBe(false);
    });

    it("長さが異なる署名は false を返すこと（タイミング攻撃対策）", async () => {
      // Arrange
      const payload = JSON.stringify({ action: "opened" });
      const secret = "test-secret-key";
      const shortSignature = "sha256=abc";

      // Act
      const result = await verifyGitHubWebhookSignature(payload, shortSignature, secret);

      // Assert
      expect(result).toBe(false);
    });
  });
});
