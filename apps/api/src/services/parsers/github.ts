import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, TECHCLIP_USER_AGENT } from "./_shared";

/** GitHubのホスト名 */
const GITHUB_HOSTNAME = "github.com";

/** GitHub REST API ベースURL */
const GITHUB_API_BASE_URL = "https://api.github.com";

/** GitHub API Accept ヘッダー */
const GITHUB_API_ACCEPT = "application/vnd.github.v3+json";

/** URLパス内のownerセグメントのインデックス */
const OWNER_SEGMENT_INDEX = 0;

/** URLパス内のrepoセグメントのインデックス */
const REPO_SEGMENT_INDEX = 1;

/** パスセグメントの最小数（owner + repo） */
const MIN_PATH_SEGMENTS = 2;

/** Issue URLのパスセグメント識別子 */
const ISSUES_PATH_SEGMENT = "issues";

/** Pull Request URLのパスセグメント識別子 */
const PULL_PATH_SEGMENT = "pull";

/** IssueまたはPR番号のセグメントインデックス（issues/N or pull/N） */
const NUMBER_SEGMENT_INDEX = 3;

/** タイプ識別セグメントのインデックス */
const TYPE_SEGMENT_INDEX = 2;

/**
 * GitHub REST API READMEレスポンスの型定義
 */
type GitHubReadmeResponse = {
  name: string;
  path: string;
  content: string;
  encoding: string;
};

/**
 * GitHub REST API Issue/PRレスポンスの型定義
 */
type GitHubIssueOrPrResponse = {
  number: number;
  title: string;
  body: string | null;
  user: { login: string };
  created_at: string;
};

/**
 * GitHub URLの種別
 */
type GitHubUrlType = "readme" | "issue" | "pull";

/**
 * パースされたGitHub URL情報
 */
type ParsedGitHubUrl = {
  owner: string;
  repo: string;
  type: GitHubUrlType;
  number?: string;
};

/**
 * GitHub URLからowner、repo、種別を抽出する
 *
 * @param url - GitHub URL
 * @returns パースされたURL情報
 * @throws Error - URLがGitHub形式でない場合
 */
function parseGitHubUrl(url: string): ParsedGitHubUrl {
  const parsed = new URL(url);

  if (parsed.hostname !== GITHUB_HOSTNAME) {
    throw new Error("GitHubのURLではありません");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length < MIN_PATH_SEGMENTS) {
    throw new Error("GitHubのURLからowner/repoを抽出できません");
  }

  const owner = segments[OWNER_SEGMENT_INDEX];
  const repo = segments[REPO_SEGMENT_INDEX];

  if (!owner || !repo) {
    throw new Error("GitHubのURLからowner/repoを抽出できません");
  }

  const typeSegment = segments[TYPE_SEGMENT_INDEX];
  const numberSegment = segments[NUMBER_SEGMENT_INDEX];

  if (typeSegment === ISSUES_PATH_SEGMENT && numberSegment) {
    return { owner, repo, type: "issue", number: numberSegment };
  }

  if (typeSegment === PULL_PATH_SEGMENT && numberSegment) {
    return { owner, repo, type: "pull", number: numberSegment };
  }

  return { owner, repo, type: "readme" };
}

/**
 * GitHub APIの共通ヘッダーを生成する
 *
 * @returns fetch用ヘッダーオブジェクト
 */
function createApiHeaders(): Record<string, string> {
  return {
    "User-Agent": TECHCLIP_USER_AGENT,
    Accept: GITHUB_API_ACCEPT,
  };
}

/**
 * リポジトリのREADMEをGitHub REST APIで取得する
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @returns パースされた記事情報
 * @throws Error - API取得に失敗した場合
 */
async function fetchReadme(owner: string, repo: string): Promise<ParsedArticle> {
  const apiUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/readme`;
  const response = await fetch(apiUrl, { headers: createApiHeaders() });

  if (!response.ok) {
    throw new Error(`GitHub APIからのデータ取得に失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as GitHubReadmeResponse;
  const content = atob(data.content);
  const plainText = content.replace(/[#*`[\]()>\-_~|]/g, "").replace(/\n+/g, " ");

  return {
    title: `${owner}/${repo}`,
    author: null,
    content,
    excerpt: null,
    thumbnailUrl: null,
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt: null,
    source: GITHUB_HOSTNAME,
  };
}

/**
 * GitHub IssueまたはPull Requestの情報をREST APIで取得する
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param type - "issue" または "pull"
 * @param number - Issue/PR番号
 * @returns パースされた記事情報
 * @throws Error - API取得に失敗した場合
 */
async function fetchIssueOrPr(
  owner: string,
  repo: string,
  type: "issue" | "pull",
  number: string,
): Promise<ParsedArticle> {
  const endpoint = type === "issue" ? "issues" : "pulls";
  const apiUrl = `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/${endpoint}/${number}`;
  const response = await fetch(apiUrl, { headers: createApiHeaders() });

  if (!response.ok) {
    throw new Error(`GitHub APIからのデータ取得に失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as GitHubIssueOrPrResponse;
  const content = data.body ?? "";
  const plainText = content.replace(/[#*`[\]()>\-_~|]/g, "").replace(/\n+/g, " ");

  return {
    title: data.title,
    author: data.user.login,
    content,
    excerpt: null,
    thumbnailUrl: null,
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt: data.created_at,
    source: GITHUB_HOSTNAME,
  };
}

/**
 * GitHub URLからREST APIでコンテンツを取得してParsedArticleに変換する
 *
 * URLパターンに応じて適切なAPIエンドポイントを呼び分ける:
 * - `github.com/{owner}/{repo}` → README取得
 * - `github.com/{owner}/{repo}/issues/{num}` → Issue取得
 * - `github.com/{owner}/{repo}/pull/{num}` → Pull Request取得
 *
 * @param url - GitHub URL
 * @returns パースされた記事情報
 * @throws Error - URLの解析、API取得に失敗した場合
 */
export async function parseGitHub(url: string): Promise<ParsedArticle> {
  const parsed = parseGitHubUrl(url);

  if (parsed.type === "readme") {
    return fetchReadme(parsed.owner, parsed.repo);
  }

  return fetchIssueOrPr(parsed.owner, parsed.repo, parsed.type, parsed.number as string);
}
