import { getRunPodEndpointId } from "@api/lib/config";
import type { Bindings } from "@api/types";
import { describe, expect, it } from "vitest";

/** テスト用のベースバインディング */
const baseBindings: Bindings = {
  TURSO_DATABASE_URL: "file:test.db",
  TURSO_AUTH_TOKEN: "test-token",
  RUNPOD_API_KEY: "test-api-key",
  RUNPOD_ENDPOINT_ID: "prod-endpoint-id",
  ENVIRONMENT: "production",
  BETTER_AUTH_SECRET: "test-secret",
  GOOGLE_CLIENT_ID: "test-google-id",
  GOOGLE_CLIENT_SECRET: "test-google-secret",
  APPLE_CLIENT_ID: "test-apple-id",
  APPLE_CLIENT_SECRET: "test-apple-secret",
  GITHUB_CLIENT_ID: "test-github-id",
  GITHUB_CLIENT_SECRET: "test-github-secret",
  RESEND_API_KEY: "test-resend-key",
  FROM_EMAIL: "test@example.com",
  RATE_LIMIT: {} as KVNamespace,
  CACHE: {} as KVNamespace,
  AVATARS_BUCKET: {} as R2Bucket,
};

describe("getRunPodEndpointId", () => {
  describe("production環境", () => {
    it("RUNPOD_ENDPOINT_IDを返すこと", () => {
      // Arrange
      const env: Bindings = {
        ...baseBindings,
        ENVIRONMENT: "production",
        RUNPOD_ENDPOINT_ID: "prod-endpoint-id",
      };

      // Act
      const result = getRunPodEndpointId(env);

      // Assert
      expect(result).toBe("prod-endpoint-id");
    });

    it("RUNPOD_LOCAL_ENDPOINT_IDが設定されていてもRUNPOD_ENDPOINT_IDを返すこと", () => {
      // Arrange
      const env: Bindings = {
        ...baseBindings,
        ENVIRONMENT: "production",
        RUNPOD_ENDPOINT_ID: "prod-endpoint-id",
        RUNPOD_LOCAL_ENDPOINT_ID: "local-endpoint-id",
      };

      // Act
      const result = getRunPodEndpointId(env);

      // Assert
      expect(result).toBe("prod-endpoint-id");
    });
  });

  describe("development環境", () => {
    it("RUNPOD_LOCAL_ENDPOINT_IDが設定されている場合はそれを返すこと", () => {
      // Arrange
      const env: Bindings = {
        ...baseBindings,
        ENVIRONMENT: "development",
        RUNPOD_ENDPOINT_ID: "prod-endpoint-id",
        RUNPOD_LOCAL_ENDPOINT_ID: "local-endpoint-id",
      };

      // Act
      const result = getRunPodEndpointId(env);

      // Assert
      expect(result).toBe("local-endpoint-id");
    });

    it("RUNPOD_LOCAL_ENDPOINT_IDが未設定の場合はRUNPOD_ENDPOINT_IDを返すこと", () => {
      // Arrange
      const env: Bindings = {
        ...baseBindings,
        ENVIRONMENT: "development",
        RUNPOD_ENDPOINT_ID: "prod-endpoint-id",
        RUNPOD_LOCAL_ENDPOINT_ID: undefined,
      };

      // Act
      const result = getRunPodEndpointId(env);

      // Assert
      expect(result).toBe("prod-endpoint-id");
    });
  });
});
