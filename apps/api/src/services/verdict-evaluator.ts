import { createLogger } from "../lib/logger";

const logger = createLogger();

/** verdict 判定結果 */
export type Verdict = "approve" | "request_changes" | "pending";

/** PR コメント情報 */
type PrComment = {
  author: { login: string };
  createdAt: string;
  body: string;
};

/** PR ラベル情報 */
type PrLabel = {
  name: string;
};

/** GitHub Actions workflow run 情報 */
type WorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  event: string;
};

/** GitHub Actions job 情報 */
type WorkflowJob = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  completed_at: string | null;
};

/** verdict-evaluator の依存注入型 */
export type VerdictEvaluatorDeps = {
  ciWorkflowName: string;
  claudeReviewJobName: string;
  aiReviewPassLabel: string;
  aiReviewNeedsWorkLabel: string;
  verdictPatterns: {
    approve: string[];
    request_changes: string[];
  };
};

/**
 * デフォルト設定値
 */
export const DEFAULT_VERDICT_EVALUATOR_DEPS: VerdictEvaluatorDeps = {
  ciWorkflowName: "CI",
  claudeReviewJobName: "claude-review",
  aiReviewPassLabel: "AI Review: PASS",
  aiReviewNeedsWorkLabel: "AI Review: NEEDS WORK",
  verdictPatterns: {
    approve: ["(\\*\\*)?✅ Approve(\\*\\*)?", "全件 PASS（0件）"],
    request_changes: ["(\\*\\*)?🔄 Request Changes(\\*\\*)?", "(\\*\\*)?💬 Comment(\\*\\*)?"],
  },
};

/** 3 条件 AND 判定の入力データ */
export type VerdictEvaluationInput = {
  workflowRuns: WorkflowRun[];
  getJobsForRun: (runId: number) => Promise<WorkflowJob[]>;
  prLabels: PrLabel[];
  prComments: PrComment[];
};

/**
 * bot コメントの判定マーカーを解析して verdict を返す
 *
 * @param body - コメント本文
 * @param deps - 設定
 * @returns verdict 文字列。判定不能なら null
 */
export function parseCommentVerdict(
  body: string,
  deps: VerdictEvaluatorDeps,
): "approve" | "request_changes" | null {
  for (const pattern of deps.verdictPatterns.approve) {
    if (new RegExp(pattern).test(body)) {
      return "approve";
    }
  }
  for (const pattern of deps.verdictPatterns.request_changes) {
    if (new RegExp(pattern).test(body)) {
      return "request_changes";
    }
  }
  return null;
}

/**
 * 3 条件 AND で PR の verdict を評価する
 *
 * 条件 1: 対象 commit SHA の CI workflow run が completed（cancelled 除く）
 * 条件 2: claude-review job が success または failure で終了
 * 条件 3-a: AI Review ラベル（PASS または NEEDS WORK）が付与されている
 * 条件 3-b: CR 完了後の claude bot コメントに判定マーカーが含まれる
 *
 * @param pushSha - push 後の HEAD commit SHA
 * @param input - PR の状態情報
 * @param deps - 設定依存
 * @returns "approve" | "request_changes" | "pending"
 */
export async function evaluateVerdict(
  pushSha: string,
  input: VerdictEvaluationInput,
  deps: VerdictEvaluatorDeps,
): Promise<Verdict> {
  const { workflowRuns, getJobsForRun, prLabels, prComments } = input;

  // 条件 1: 対象 commit の CI workflow run が completed
  const targetRun = workflowRuns.find(
    (run) =>
      run.name === deps.ciWorkflowName &&
      run.event === "pull_request" &&
      run.status === "completed" &&
      run.conclusion !== "cancelled",
  );

  if (!targetRun) {
    logger.info("verdict pending: CI workflow run が完了していない", { pushSha });
    return "pending";
  }

  // 条件 2: claude-review job が終了
  let jobs: WorkflowJob[];
  try {
    jobs = await getJobsForRun(targetRun.id);
  } catch (err) {
    logger.info("verdict pending: getJobsForRun がエラーを投げた", { runId: targetRun.id, err });
    return "pending";
  }
  const claudeReviewJob = jobs.find((job) => job.name === deps.claudeReviewJobName);

  if (!claudeReviewJob) {
    logger.info("verdict pending: claude-review job が見つからない", { runId: targetRun.id });
    return "pending";
  }

  const jobConclusion = claudeReviewJob.conclusion;
  if (jobConclusion !== "success" && jobConclusion !== "failure") {
    logger.info("verdict pending: claude-review job が終了していない", { jobConclusion });
    return "pending";
  }

  const crCompleted = claudeReviewJob.completed_at;
  if (!crCompleted) {
    logger.info("verdict pending: claude-review job の completed_at が未設定");
    return "pending";
  }

  // 条件 3-a: AI Review ラベル付与
  const hasReviewLabel = prLabels.some(
    (l) => l.name === deps.aiReviewPassLabel || l.name === deps.aiReviewNeedsWorkLabel,
  );

  if (!hasReviewLabel) {
    logger.info("verdict pending: AI Review ラベルが付与されていない");
    return "pending";
  }

  // 条件 3-b: claude-review 判定コメント（CR 完了後かつ判定マーカーあり）
  const botComments = prComments
    .filter(
      (c) =>
        c.author.login === "claude" &&
        c.createdAt >= crCompleted &&
        c.body.includes("## PRレビュー結果"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const latestBotComment = botComments[0];
  if (!latestBotComment) {
    logger.info("verdict pending: claude-review 判定コメントが見つからない");
    return "pending";
  }

  const commentVerdict = parseCommentVerdict(latestBotComment.body, deps);
  if (!commentVerdict) {
    logger.info("verdict pending: コメントに判定マーカーが含まれない");
    return "pending";
  }

  logger.info("verdict 確定", { verdict: commentVerdict, pushSha });
  return commentVerdict;
}
