import {
  DEFAULT_VERDICT_EVALUATOR_DEPS,
  evaluateVerdict,
  parseCommentVerdict,
} from "@api/services/verdict-evaluator";
import { describe, expect, it, vi } from "vitest";

const BASE_DEPS = DEFAULT_VERDICT_EVALUATOR_DEPS;

/** テスト用 workflow run のファクトリ */
function makeRun(
  overrides: { name?: string; status?: string; conclusion?: string | null; event?: string } = {},
) {
  return {
    id: 1,
    name: overrides.name ?? "CI",
    status: overrides.status ?? "completed",
    conclusion: overrides.conclusion ?? "success",
    event: overrides.event ?? "pull_request",
  };
}

/** テスト用 job のファクトリ */
function makeJob(
  overrides: { name?: string; conclusion?: string | null; completed_at?: string | null } = {},
) {
  const defaults = {
    id: 1,
    name: "claude-review",
    status: "completed",
    conclusion: "success" as string | null,
    completed_at: "2025-01-01T00:05:00Z" as string | null,
  };
  return { ...defaults, ...overrides };
}

/** テスト用 PR コメントのファクトリ */
function makeComment(overrides: { login?: string; createdAt?: string; body?: string } = {}) {
  return {
    author: { login: overrides.login ?? "claude" },
    createdAt: overrides.createdAt ?? "2025-01-01T00:10:00Z",
    body: overrides.body ?? "## PRレビュー結果\n\n**✅ Approve**\n\n全件 PASS（0件）",
  };
}

describe("parseCommentVerdict", () => {
  describe("approve パターン", () => {
    it("✅ Approve を含むコメントを approve と判定すること", () => {
      const result = parseCommentVerdict("**✅ Approve**", BASE_DEPS);
      expect(result).toBe("approve");
    });

    it("全件 PASS（0件）を含むコメントを approve と判定すること", () => {
      const result = parseCommentVerdict("全件 PASS（0件）", BASE_DEPS);
      expect(result).toBe("approve");
    });

    it("ボールド記号なしの ✅ Approve を approve と判定すること", () => {
      const result = parseCommentVerdict("✅ Approve", BASE_DEPS);
      expect(result).toBe("approve");
    });
  });

  describe("request_changes パターン", () => {
    it("🔄 Request Changes を含むコメントを request_changes と判定すること", () => {
      const result = parseCommentVerdict("**🔄 Request Changes**", BASE_DEPS);
      expect(result).toBe("request_changes");
    });

    it("💬 Comment を含むコメントを request_changes と判定すること", () => {
      const result = parseCommentVerdict("**💬 Comment**", BASE_DEPS);
      expect(result).toBe("request_changes");
    });
  });

  describe("未判定パターン", () => {
    it("判定マーカーがないコメントは null を返すこと", () => {
      const result = parseCommentVerdict("レビュー中です", BASE_DEPS);
      expect(result).toBeNull();
    });

    it("空文字は null を返すこと", () => {
      const result = parseCommentVerdict("", BASE_DEPS);
      expect(result).toBeNull();
    });
  });
});

describe("evaluateVerdict", () => {
  const PUSH_SHA = "abc1234567890";

  describe("条件 1: CI workflow run 未完了", () => {
    it("workflow run が見つからない場合は pending を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        { workflowRuns: [], getJobsForRun: vi.fn(), prLabels: [], prComments: [] },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("CI workflow run が in_progress の場合は pending を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun({ status: "in_progress", conclusion: null })],
          getJobsForRun: vi.fn(),
          prLabels: [],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("CI workflow run が cancelled の場合は pending を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun({ status: "completed", conclusion: "cancelled" })],
          getJobsForRun: vi.fn(),
          prLabels: [],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("別の名前の workflow run は無視すること", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun({ name: "Deploy" })],
          getJobsForRun: vi.fn(),
          prLabels: [],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("push イベントの workflow run は無視すること", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun({ event: "push" })],
          getJobsForRun: vi.fn(),
          prLabels: [],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });
  });

  describe("条件 2: claude-review job 未完了", () => {
    it("claude-review job が見つからない場合は pending を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([]),
          prLabels: [],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("claude-review job が in_progress の場合は pending を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob({ conclusion: null })]),
          prLabels: [],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("claude-review job が queued の場合は pending を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob({ conclusion: "queued" })]),
          prLabels: [],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });
  });

  describe("条件 3-a: ラベル未付与", () => {
    it("AI Review ラベルがない場合は pending を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob()]),
          prLabels: [{ name: "bug" }],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });
  });

  describe("条件 3-b: 判定コメント未投稿", () => {
    it("claude bot のコメントがない場合は pending を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob()]),
          prLabels: [{ name: "AI Review: PASS" }],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("CR 完了前のコメントは無視すること", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi
            .fn()
            .mockResolvedValue([makeJob({ completed_at: "2025-01-01T00:05:00Z" })]),
          prLabels: [{ name: "AI Review: PASS" }],
          prComments: [makeComment({ createdAt: "2025-01-01T00:04:59Z" })],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("## PRレビュー結果 を含まないコメントは無視すること", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob()]),
          prLabels: [{ name: "AI Review: PASS" }],
          prComments: [makeComment({ body: "✅ Approve" })],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("claude 以外のユーザーのコメントは無視すること", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob()]),
          prLabels: [{ name: "AI Review: PASS" }],
          prComments: [makeComment({ login: "github-actions[bot]" })],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });
  });

  describe("3 条件 AND 確定パターン", () => {
    it("全条件が揃った場合 approve を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob()]),
          prLabels: [{ name: "AI Review: PASS" }],
          prComments: [makeComment()],
        },
        BASE_DEPS,
      );
      expect(result).toBe("approve");
    });

    it("claude-review job が failure でも判定コメントが approve なら approve を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob({ conclusion: "failure" })]),
          prLabels: [{ name: "AI Review: PASS" }],
          prComments: [makeComment()],
        },
        BASE_DEPS,
      );
      expect(result).toBe("approve");
    });

    it("AI Review: NEEDS WORK ラベル + Request Changes コメントで request_changes を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob()]),
          prLabels: [{ name: "AI Review: NEEDS WORK" }],
          prComments: [makeComment({ body: "## PRレビュー結果\n\n**🔄 Request Changes**" })],
        },
        BASE_DEPS,
      );
      expect(result).toBe("request_changes");
    });

    it("複数コメントがある場合は最新のものを使うこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob()]),
          prLabels: [{ name: "AI Review: NEEDS WORK" }],
          prComments: [
            makeComment({
              createdAt: "2025-01-01T00:10:00Z",
              body: "## PRレビュー結果\n\n**🔄 Request Changes**",
            }),
            makeComment({
              createdAt: "2025-01-01T00:20:00Z",
              body: "## PRレビュー結果\n\n**🔄 Request Changes**\n\n再レビューも同様です",
            }),
          ],
        },
        BASE_DEPS,
      );
      expect(result).toBe("request_changes");
    });

    it("CI failure でもレビューが approve なら approve を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun({ conclusion: "failure" })],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob()]),
          prLabels: [{ name: "AI Review: PASS" }],
          prComments: [makeComment()],
        },
        BASE_DEPS,
      );
      expect(result).toBe("approve");
    });
  });

  describe("エッジケース", () => {
    it("getJobsForRun がエラーを投げた場合でも処理を継続すること", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockRejectedValue(new Error("API error")),
          prLabels: [],
          prComments: [],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("completed_at が null の claude-review job は pending を返すこと", async () => {
      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun()],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob({ completed_at: null })]),
          prLabels: [{ name: "AI Review: PASS" }],
          prComments: [makeComment()],
        },
        BASE_DEPS,
      );
      expect(result).toBe("pending");
    });

    it("カスタム CI 名で正しく判定できること", async () => {
      const customDeps = {
        ...BASE_DEPS,
        ciWorkflowName: "Custom CI",
        claudeReviewJobName: "my-claude-review",
      };

      const result = await evaluateVerdict(
        PUSH_SHA,
        {
          workflowRuns: [makeRun({ name: "Custom CI" })],
          getJobsForRun: vi.fn().mockResolvedValue([makeJob({ name: "my-claude-review" })]),
          prLabels: [{ name: "AI Review: PASS" }],
          prComments: [makeComment()],
        },
        customDeps,
      );
      expect(result).toBe("approve");
    });
  });
});
