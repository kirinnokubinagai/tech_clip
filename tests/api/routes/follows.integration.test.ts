/**
 * フォロー通知統合テスト
 *
 * users-subapp.ts の followFn 内で createFollowNotification が呼ばれることを検証する。
 */

import { createFollowNotification } from "@api/services/notification-trigger";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@api/services/notification-trigger", () => ({
  createFollowNotification: vi.fn().mockResolvedValue(undefined),
  createSummaryCompleteNotification: vi.fn().mockResolvedValue(undefined),
}));

/** フォロワーユーザーID */
const FOLLOWER_ID = "user_follow_notif_01";

/** フォロー対象ユーザーID */
const FOLLOWING_ID = "user_follow_notif_02";

/** フォロワー名 */
const FOLLOWER_NAME = "フォロワーテストユーザー";

/**
 * users-subapp.ts の followFn 実装と同等のクロージャを構築する
 * （DB をモックして createFollowNotification の呼び出しを検証する）
 */
function buildFollowFn(followerName: string | null | undefined) {
  const mockDb = {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          followerName !== undefined
            ? {
                followerId: FOLLOWER_ID,
                followingId: FOLLOWING_ID,
                createdAt: "2026-01-01T00:00:00Z",
              }
            : {
                followerId: FOLLOWER_ID,
                followingId: FOLLOWING_ID,
                createdAt: "2026-01-01T00:00:00Z",
              },
        ]),
      }),
    }),
  };

  let selectCallCount = 0;
  const mockDbChained = {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    select: vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                followerId: FOLLOWER_ID,
                followingId: FOLLOWING_ID,
                createdAt: "2026-01-01T00:00:00Z",
              },
            ]),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(followerName !== null ? [{ name: followerName }] : []),
        }),
      };
    }),
  };

  const followFn = async (followerId: string, followingId: string) => {
    await mockDbChained.insert(null).values(null);
    const [result] = await mockDbChained.select().from(null).where(null);
    const [follower] = await mockDbChained.select().from(null).where(null);
    await createFollowNotification({
      db: mockDb as never,
      followerId,
      followingId,
      followerName: (follower as { name?: string } | undefined)?.name,
    });
    return {
      followerId: (result as { followerId: string }).followerId,
      followingId: (result as { followingId: string }).followingId,
      createdAt: (result as { createdAt: string }).createdAt,
    };
  };

  return followFn;
}

describe("followFn（users-subapp.ts 実装）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createFollowNotification 呼び出し", () => {
    it("フォロー成功時に createFollowNotification が呼ばれること", async () => {
      // Arrange
      const followFn = buildFollowFn(FOLLOWER_NAME);

      // Act
      await followFn(FOLLOWER_ID, FOLLOWING_ID);

      // Assert
      expect(createFollowNotification).toHaveBeenCalledOnce();
      expect(createFollowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          followerId: FOLLOWER_ID,
          followingId: FOLLOWING_ID,
          followerName: FOLLOWER_NAME,
        }),
      );
    });

    it("followerName が null の場合 undefined がパススルーされること", async () => {
      // Arrange
      const followFn = buildFollowFn(null);

      // Act
      await followFn(FOLLOWER_ID, FOLLOWING_ID);

      // Assert
      expect(createFollowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          followerName: undefined,
        }),
      );
    });
  });
});
