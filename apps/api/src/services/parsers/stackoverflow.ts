import TurndownService from "turndown";

import { safeFetch } from "../../lib/safe-fetch";
import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, htmlFragmentToMarkdown, TECHCLIP_USER_AGENT } from "./_shared";

/** Stack Exchange APIのベースURL */
const SE_API_BASE_URL = "https://api.stackexchange.com/2.3/questions";

/** Stack Overflowのホスト名 */
const SO_HOSTNAME = "stackoverflow.com";

/** ミリ秒変換係数 */
const UNIX_TO_MS_MULTIPLIER = 1000;

/** SO APIフィルター（質問body + 回答body取得用） */
const SO_API_FILTER = "!nNPvSNdWme";

/** question_idを抽出する正規表現（/questions/ID or /q/ID） */
const QUESTION_ID_PATTERN = /\/(?:questions|q)\/(\d+)/;

/**
 * Stack Overflow APIレスポンスの回答型定義
 */
type StackOverflowAnswer = {
  answer_id: number;
  body: string;
  is_accepted: boolean;
  owner?: {
    display_name: string;
  };
  score: number;
};

/**
 * Stack Overflow APIレスポンスの質問型定義
 */
type StackOverflowQuestion = {
  question_id: number;
  title: string;
  body: string;
  owner?: {
    display_name: string;
  };
  accepted_answer_id?: number;
  creation_date: number;
  answers?: StackOverflowAnswer[];
};

/**
 * Stack Exchange APIレスポンスのラッパー型定義
 */
type StackExchangeResponse = {
  items: StackOverflowQuestion[];
  has_more: boolean;
  quota_max: number;
  quota_remaining: number;
};

/**
 * Stack Overflow URLからquestion_idを抽出する
 *
 * @param url - Stack OverflowのURL（例: https://stackoverflow.com/questions/12345678/title-slug）
 * @returns question_id（文字列）
 * @throws Error - URLがStack Overflow形式でない、またはquestion_idが抽出できない場合
 */
function extractQuestionId(url: string): string {
  const parsed = new URL(url);

  if (parsed.hostname !== SO_HOSTNAME) {
    throw new Error("Stack OverflowのURLではありません");
  }

  const match = parsed.pathname.match(QUESTION_ID_PATTERN);

  if (!match?.[1]) {
    throw new Error("Stack OverflowのURLからquestion_idを抽出できません");
  }

  return match[1];
}

/**
 * UNIXタイムスタンプをISO 8601文字列に変換する
 *
 * @param unixTime - UNIXタイムスタンプ（秒）
 * @returns ISO 8601形式の日時文字列
 */
function unixToIso(unixTime: number): string {
  return new Date(unixTime * UNIX_TO_MS_MULTIPLIER).toISOString();
}

/**
 * HTMLタグを除去してプレーンテキストを取得する
 *
 * @param html - HTMLコンテンツ
 * @returns タグを除去したテキスト
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * accepted_answerを質問のanswers配列から探す
 *
 * @param question - SO APIレスポンスの質問データ
 * @returns accepted_answerのbody（HTML）。見つからない場合はnull
 */
function findAcceptedAnswer(question: StackOverflowQuestion): string | null {
  if (!question.accepted_answer_id || !question.answers) {
    return null;
  }

  const accepted = question.answers.find((a) => a.is_accepted);

  if (!accepted) {
    return null;
  }

  return accepted.body;
}

/**
 * 質問本文とaccepted_answerからMarkdownコンテンツを組み立てる
 *
 * @param questionBody - 質問本文（HTML）
 * @param acceptedAnswerBody - accepted_answer本文（HTML）。nullの場合は質問本文のみ
 * @returns Markdown変換済みコンテンツ
 */
function buildContent(questionBody: string, acceptedAnswerBody: string | null): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  const questionMd = htmlFragmentToMarkdown(questionBody, turndown);

  if (!acceptedAnswerBody) {
    return questionMd;
  }

  const answerMd = htmlFragmentToMarkdown(acceptedAnswerBody, turndown);

  return `${questionMd}\n\n---\n\n## Accepted Answer\n\n${answerMd}`;
}

/**
 * Stack Overflow URLからSO API経由で質問+回答情報を取得してParsedArticleに変換する
 *
 * URLからquestion_idを抽出し、Stack Exchange APIで質問データ（body付き）を取得する。
 * accepted_answerがある場合はコンテンツに含める。
 *
 * @param url - Stack OverflowのURL（例: https://stackoverflow.com/questions/12345678/title-slug）
 * @returns パースされた記事情報
 * @throws Error - URLが不正、またはAPI取得に失敗した場合
 */
export async function parseStackOverflow(url: string): Promise<ParsedArticle> {
  const questionId = extractQuestionId(url);

  const apiUrl = `${SE_API_BASE_URL}/${questionId}?site=stackoverflow&filter=${SO_API_FILTER}&order=desc&sort=votes`;
  const response = await safeFetch(apiUrl, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Stack Overflow質問の取得に失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as StackExchangeResponse;

  if (!data.items || data.items.length === 0) {
    throw new Error("Stack Overflow質問が見つかりません");
  }

  const question = data.items[0];
  const author = question.owner?.display_name ?? null;
  const publishedAt = unixToIso(question.creation_date);

  const acceptedAnswerBody = findAcceptedAnswer(question);
  const content = buildContent(question.body, acceptedAnswerBody);

  const allHtml = acceptedAnswerBody ? `${question.body} ${acceptedAnswerBody}` : question.body;
  const plainText = stripHtmlTags(allHtml);

  return {
    title: question.title,
    author,
    content,
    excerpt: null,
    thumbnailUrl: null,
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt,
    source: SO_HOSTNAME,
  };
}
