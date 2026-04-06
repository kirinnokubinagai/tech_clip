import { toRecord, toRecordArray } from "@api/lib/db-cast";
import { describe, expect, it } from "vitest";

describe("toRecord", () => {
  it("オブジェクトをそのまま返すこと", () => {
    // Arrange
    const input = { id: "01J000000000000000000001", title: "テスト記事", count: 42 };

    // Act
    const result = toRecord(input);

    // Assert
    expect(result).toEqual({ id: "01J000000000000000000001", title: "テスト記事", count: 42 });
  });

  it("ネストしたオブジェクトをそのまま返すこと", () => {
    // Arrange
    const input = { article: { id: "123", tags: ["tech", "web"] }, meta: { total: 10 } };

    // Act
    const result = toRecord(input);

    // Assert
    expect(result).toEqual({ article: { id: "123", tags: ["tech", "web"] }, meta: { total: 10 } });
  });

  it("空オブジェクトをそのまま返すこと", () => {
    // Arrange
    const input = {};

    // Act
    const result = toRecord(input);

    // Assert
    expect(result).toEqual({});
  });

  it("null値を含むオブジェクトをそのまま返すこと", () => {
    // Arrange
    const input = { id: "123", summary: null };

    // Act
    const result = toRecord(input);

    // Assert
    expect(result).toEqual({ id: "123", summary: null });
  });
});

describe("toRecordArray", () => {
  it("オブジェクト配列をそのまま返すこと", () => {
    // Arrange
    const input = [
      { id: "01J000000000000000000001", title: "記事1" },
      { id: "01J000000000000000000002", title: "記事2" },
    ];

    // Act
    const result = toRecordArray(input);

    // Assert
    expect(result).toEqual([
      { id: "01J000000000000000000001", title: "記事1" },
      { id: "01J000000000000000000002", title: "記事2" },
    ]);
  });

  it("空配列をそのまま返すこと", () => {
    // Arrange
    const input: Record<string, unknown>[] = [];

    // Act
    const result = toRecordArray(input);

    // Assert
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it("単一要素の配列をそのまま返すこと", () => {
    // Arrange
    const input = [{ id: "01J000000000000000000001", value: 100 }];

    // Act
    const result = toRecordArray(input);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: "01J000000000000000000001", value: 100 });
  });

  it("ネストしたオブジェクトを含む配列をそのまま返すこと", () => {
    // Arrange
    const input = [{ article: { id: "123" }, author: { name: "テストユーザー" } }];

    // Act
    const result = toRecordArray(input);

    // Assert
    expect(result[0]).toEqual({ article: { id: "123" }, author: { name: "テストユーザー" } });
  });
});
