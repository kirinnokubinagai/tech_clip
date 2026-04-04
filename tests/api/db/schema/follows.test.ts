import { follows } from "@api/db/schema/follows";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("follows schema", () => {
  it("followerIdフィールドが定義されていること", () => {
    const columns = getTableColumns(follows);
    expect(columns.followerId).toBeDefined();
    expect(columns.followerId.notNull).toBe(true);
  });

  it("followingIdフィールドが定義されていること", () => {
    const columns = getTableColumns(follows);
    expect(columns.followingId).toBeDefined();
    expect(columns.followingId.notNull).toBe(true);
  });

  it("createdAtフィールドが定義されていること", () => {
    const columns = getTableColumns(follows);
    expect(columns.createdAt).toBeDefined();
  });

  it("複合主キーとしてfollowerIdとfollowingIdが設定されていること", () => {
    const columns = getTableColumns(follows);
    const columnNames = Object.keys(columns);
    expect(columnNames).toContain("followerId");
    expect(columnNames).toContain("followingId");
    expect(columnNames).toContain("createdAt");
  });

  it("TypeScript型が正しくエクスポートされること", () => {
    const follow: typeof follows.$inferSelect = {} as never;
    expect(follow).toBeDefined();
  });
});
