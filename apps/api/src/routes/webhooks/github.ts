import { Hono } from "hono";
import { z } from "zod";

import { createLogger } from "../../lib/logger";
import { verifyGitHubWebhookSignature } from "../../services/github-webhook-verifier";
import { DEFAULT_VERDICT_EVALUATOR_DEPS, evaluateVerdict } from "../../services/verdict-evaluator";
import type { AppEnv } from "../../types";

const logger = createLogger();

/** HTTP ステータスコード */
const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;

/** エラーコード */
const INVALID_REQUEST_CODE = "INVALID_REQUEST";
const AUTH_REQUIRED_CODE = "AUTH_REQUIRED";

/** GitHub webhook イベント種別 */
const SUPPORTED_EVENTS = ["pull_request", "pull_request_review", "issue_comment"] as const;

/** PR 番号を含む最小限のペイロードスキーマ */
const GitHubWebhookBaseSchema = z.object({
  action: z.string(),
  pull_request: z
    .object({
      number: z.number(),
      base: z.object({ ref: z.string() }),
      head: z.object({ sha: z.string() }),
      labels: z.array(z.object({ name: z.string() })).optional(),
    })
    .optional(),
  issue: z
    .object({
      number: z.number(),
      pull_request: z.object({}).optional(),
    })
    .optional(),
  comment: z
    .object({
      body: z.string(),
      user: z.object({ login: z.string() }),
      created_at: z.string(),
    })
    .optional(),
  label: z.object({ name: z.string() }).optional(),
  installation: z.object({ id: z.number() }).optional(),
  repository: z.object({
    name: z.string(),
    owner: z.object({ login: z.string() }),
  }),
  sender: z.object({ login: z.string() }),
});

/** createGitHubWebhookRoute のオプション */
type GitHubWebhookRouteOptions = {
  /** HMAC 検証シークレット */
  webhookSecret: string;
};

/**
 * GitHub Webhook 受信ルートを生成する
 *
 * POST /webhooks/github: GitHub から送信される PR イベントを受信し、
 * 3 条件 AND 判定を行って verdict が確定した場合にログ出力する
 *
 * @param options - webhook secret
 * @returns Hono ルーターインスタンス
 */
export function createGitHubWebhookRoute(options: GitHubWebhookRouteOptions) {
  const { webhookSecret } = options;
  const route = new Hono<AppEnv>();

  route.post("/webhooks/github", async (c) => {
    const eventType = c.req.header("X-GitHub-Event");
    const signature = c.req.header("X-Hub-Signature-256") ?? "";
    const deliveryId = c.req.header("X-GitHub-Delivery") ?? "unknown";

    // webhook secret が未設定の場合は 401
    if (!webhookSecret) {
      logger.error("GitHub webhook secret が未設定");
      return c.json(
        {
          success: false,
          error: { code: AUTH_REQUIRED_CODE, message: "Webhook secret が設定されていません" },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    // サポート外のイベントは早期リターン
    if (!eventType || !SUPPORTED_EVENTS.includes(eventType as (typeof SUPPORTED_EVENTS)[number])) {
      return c.json({ success: true, data: { skipped: true, event: eventType } }, HTTP_OK);
    }

    // ペイロードを取得して HMAC 検証
    const rawBody = await c.req.text();
    const isValid = await verifyGitHubWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      logger.error("GitHub webhook 署名検証失敗", { deliveryId, eventType });
      return c.json(
        {
          success: false,
          error: { code: AUTH_REQUIRED_CODE, message: "署名が一致しません" },
        },
        HTTP_UNAUTHORIZED,
      );
    }

    // JSON パース
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json(
        {
          success: false,
          error: { code: INVALID_REQUEST_CODE, message: "JSON パースに失敗しました" },
        },
        HTTP_BAD_REQUEST,
      );
    }

    const parsed = GitHubWebhookBaseSchema.safeParse(payload);
    if (!parsed.success) {
      logger.error("GitHub webhook ペイロード検証失敗", {
        deliveryId,
        errors: parsed.error.issues,
      });
      return c.json(
        {
          success: false,
          error: {
            code: INVALID_REQUEST_CODE,
            message: "ペイロードの形式が正しくありません",
            details: parsed.error.issues,
          },
        },
        HTTP_BAD_REQUEST,
      );
    }

    const data = parsed.data;
    const owner = data.repository.owner.login;
    const repo = data.repository.name;

    // PR 番号を特定
    let prNumber: number | null = null;
    if (data.pull_request) {
      prNumber = data.pull_request.number;
    } else if (data.issue?.pull_request) {
      prNumber = data.issue.number;
    }

    if (!prNumber) {
      return c.json(
        { success: true, data: { skipped: true, reason: "PR でないイベント" } },
        HTTP_OK,
      );
    }

    logger.info("GitHub webhook 受信", { deliveryId, eventType, prNumber, owner, repo });

    // PR の状態を GitHub API から取得して 3 条件 AND 判定を実行
    // Workers 環境では GitHub API を直接呼び出す
    try {
      const githubToken = (c.env as { GITHUB_TOKEN?: string }).GITHUB_TOKEN;
      if (!githubToken) {
        logger.info("GITHUB_TOKEN 未設定: verdict 判定をスキップ", { prNumber });
        return c.json({ success: true, data: { received: true, evaluated: false } }, HTTP_OK);
      }

      const headers = {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };

      // PR 情報取得
      const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers,
      });
      if (!prRes.ok) {
        logger.error("PR 情報取得失敗", { status: prRes.status });
        return c.json({ success: true, data: { received: true, evaluated: false } }, HTTP_OK);
      }
      const prData = (await prRes.json()) as {
        head: { sha: string };
        labels: Array<{ name: string }>;
        base: { ref: string };
      };

      const pushSha = prData.head.sha;
      const prLabels = prData.labels;

      // PR コメント取得
      const commentsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`,
        { headers },
      );
      const prComments = commentsRes.ok
        ? (
            (await commentsRes.json()) as Array<{
              user: { login: string };
              created_at: string;
              body: string;
            }>
          ).map((c) => ({
            author: { login: c.user.login },
            createdAt: c.created_at,
            body: c.body,
          }))
        : [];

      // workflow runs 取得
      const runsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/runs?head_sha=${pushSha}&per_page=20`,
        { headers },
      );
      const workflowRuns = runsRes.ok
        ? (
            (await runsRes.json()) as {
              workflow_runs: Array<{
                id: number;
                name: string;
                status: string;
                conclusion: string | null;
                event: string;
              }>;
            }
          ).workflow_runs
        : [];

      const verdict = await evaluateVerdict(
        pushSha,
        {
          workflowRuns,
          getJobsForRun: async (runId: number) => {
            const jobsRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
              { headers },
            );
            if (!jobsRes.ok) return [];
            const jobsData = (await jobsRes.json()) as {
              jobs: Array<{
                id: number;
                name: string;
                status: string;
                conclusion: string | null;
                completed_at: string | null;
              }>;
            };
            return jobsData.jobs;
          },
          prLabels,
          prComments,
        },
        DEFAULT_VERDICT_EVALUATOR_DEPS,
      );

      logger.info("verdict 評価完了", { prNumber, verdict, pushSha });

      return c.json(
        { success: true, data: { received: true, evaluated: true, verdict, prNumber } },
        HTTP_OK,
      );
    } catch (error) {
      logger.error("verdict 評価中にエラー", { error, prNumber });
      return c.json({ success: true, data: { received: true, evaluated: false } }, HTTP_OK);
    }
  });

  return route;
}
