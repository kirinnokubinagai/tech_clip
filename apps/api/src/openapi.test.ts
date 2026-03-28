import { describe, expect, it } from "vitest";
import { openApiSpec } from "./openapi";

describe("openApiSpec", () => {
  it("有効なOpenAPI 3.0仕様オブジェクトであること", () => {
    // Arrange & Act
    const spec = openApiSpec;

    // Assert
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBe("TechClip API");
    expect(spec.info.version).toBeDefined();
    expect(spec.paths).toBeDefined();
  });

  it("期待されるパスが含まれること", () => {
    // Arrange
    const spec = openApiSpec;

    // Assert
    expect(spec.paths["/health"]).toBeDefined();
    expect(spec.paths["/api/articles"]).toBeDefined();
    expect(spec.paths["/api/articles/{id}"]).toBeDefined();
    expect(spec.paths["/api/articles/{id}/favorite"]).toBeDefined();
    expect(spec.paths["/api/users/me"]).toBeDefined();
    expect(spec.paths["/api/users/me/avatar"]).toBeDefined();
    expect(spec.paths["/api/users/{id}/articles"]).toBeDefined();
    expect(spec.paths["/api/users/{id}/follow"]).toBeDefined();
    expect(spec.paths["/api/users/{id}/followers"]).toBeDefined();
    expect(spec.paths["/api/users/{id}/following"]).toBeDefined();
    expect(spec.paths["/api/tags"]).toBeDefined();
    expect(spec.paths["/api/tags/{id}"]).toBeDefined();
    expect(spec.paths["/api/articles/{id}/tags"]).toBeDefined();
    expect(spec.paths["/api/search"]).toBeDefined();
    expect(spec.paths["/api/notifications"]).toBeDefined();
    expect(spec.paths["/api/register"]).toBeDefined();
    expect(spec.paths["/api/notifications/{id}/read"]).toBeDefined();
    expect(spec.paths["/api/articles/{id}/translate"]).toBeDefined();
    expect(spec.paths["/api/articles/{id}/summary"]).toBeDefined();
    expect(spec.paths["/api/subscription/status"]).toBeDefined();
    expect(spec.paths["/api/subscription/webhooks/revenuecat"]).toBeDefined();
  });

  it("componentsにセキュリティスキームが定義されていること", () => {
    // Arrange & Act
    const spec = openApiSpec;

    // Assert
    expect(spec.components).toBeDefined();
    expect(spec.components?.securitySchemes).toBeDefined();
    expect(spec.components?.securitySchemes?.BearerAuth).toBeDefined();
  });

  it("各パスに少なくとも1つのHTTPメソッドが定義されていること", () => {
    // Arrange
    const spec = openApiSpec;
    const validMethods = ["get", "post", "put", "patch", "delete"];

    // Act & Assert
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const hasMethod = validMethods.some((method) => method in pathItem);
      expect(hasMethod, `パス ${path} にHTTPメソッドが定義されていません`).toBe(true);
    }
  });

  it("JSON文字列に変換できること", () => {
    // Arrange & Act
    const json = JSON.stringify(openApiSpec);

    // Assert
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.openapi).toBe("3.0.3");
  });
});
