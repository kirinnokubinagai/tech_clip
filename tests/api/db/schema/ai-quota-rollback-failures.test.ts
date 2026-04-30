import { aiQuotaRollbackFailures } from "@api/db/schema/ai-quota-rollback-failures";
import { describe, expect, it } from "vitest";

describe("aiQuotaRollbackFailures スキーマ", () => {
  describe("テーブル定義", () => {
    it("テーブル名が ai_quota_rollback_failures であること", () => {
      expect(aiQuotaRollbackFailures[Symbol.for("drizzle:Name")]).toBe(
        "ai_quota_rollback_failures",
      );
    });

    it("id カラムが primaryKey であること", () => {
      const col = aiQuotaRollbackFailures.id;
      expect(col.primary).toBe(true);
    });

    it("user_id カラムが notNull であること", () => {
      const col = aiQuotaRollbackFailures.userId;
      expect(col.notNull).toBe(true);
    });

    it("reservation_path カラムが notNull であること", () => {
      const col = aiQuotaRollbackFailures.reservationPath;
      expect(col.notNull).toBe(true);
    });

    it("occurred_at カラムが notNull でデフォルト値を持つこと", () => {
      const col = aiQuotaRollbackFailures.occurredAt;
      expect(col.notNull).toBe(true);
      expect(col.default).toBeDefined();
    });

    it("resolved_at カラムが nullable であること", () => {
      const col = aiQuotaRollbackFailures.resolvedAt;
      expect(col.notNull).toBeFalsy();
    });

    it("applied_adjustment カラムが nullable であること", () => {
      const col = aiQuotaRollbackFailures.appliedAdjustment;
      expect(col.notNull).toBeFalsy();
    });

    it("error_message カラムが nullable であること", () => {
      const col = aiQuotaRollbackFailures.errorMessage;
      expect(col.notNull).toBeFalsy();
    });
  });

  describe("型推論", () => {
    it("$inferSelect の型が期待するフィールドを持つこと", () => {
      type Row = typeof aiQuotaRollbackFailures.$inferSelect;
      const _typeCheck: {
        id: string;
        userId: string;
        reservationPath: string;
        errorMessage: string | null;
        occurredAt: string;
        resolvedAt: string | null;
        appliedAdjustment: string | null;
      } = {} as Row;
      expect(_typeCheck).toBeDefined();
    });

    it("$inferInsert で id を指定できること", () => {
      type InsertRow = typeof aiQuotaRollbackFailures.$inferInsert;
      const _typeCheck: InsertRow = {
        id: "test-id",
        userId: "user-id",
        reservationPath: "existing-free-use",
      };
      expect(_typeCheck.id).toBe("test-id");
    });
  });
});
