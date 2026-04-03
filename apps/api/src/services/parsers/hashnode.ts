import type { ParsedArticle } from "../../types/article";

/** Hashnode GraphQL APIエンドポイント */
const HASHNODE_GRAPHQL_URL = "https://gql.hashnode.com";

/** Hashnodeのホストパターンにマッチするサフィックス */
const HASHNODE_HOST_SUFFIX = "hashnode.dev";

/** fetch時のUser-Agent */
const USER_AGENT = "Mozilla/5.0 (compatible; TechClipBot/1.0; +https://techclip.app)";

/** 読了速度（文字/分） */
const READING_SPEED_CHARS_PER_MIN = 500;

/** 最小読了時間（分） */
const MIN_READING_TIME_MINUTES = 1;

/** パスセグメントの最小数（slug） */
const MIN_PATH_SEGMENTS = 1;

/** Hashnode記事ソース識別子 */
const HASHNODE_SOURCE = "hashnode.dev";

/** Hashnode GraphQL クエリ */
const HASHNODE_POST_QUERY = `
  query GetPost($host: String!, $slug: String!) {
    publication(host: $host) {
      post(slug: $slug) {
        title
        contentMarkdown
        author {
          name
        }
        coverImage {
          url
        }
        publishedAt
      }
    }
  }
`;

/**
 * Hashnode GraphQL APIレスポンスの投稿情報
 */
type HashnodePost = {
  title: string;
  contentMarkdown: string;
  author: {
    name: string;
  };
  coverImage: {
    url: string;
  } | null;
  publishedAt: string;
};

/**
 * Hashnode GraphQL APIレスポンス
 */
type HashnodeGraphqlResponse = {
  data: {
    publication: {
      post: HashnodePost | null;
    } | null;
  };
};

/**
 * URLがHashnodeのホストかどうかを判定する
 *
 * @param hostname - ホスト名
 * @returns HashnodeのURLの場合true
 */
function isHashnodeHost(hostname: string): boolean {
  return hostname === HASHNODE_HOST_SUFFIX || hostname.endsWith(`.${HASHNODE_HOST_SUFFIX}`);
}

/**
 * Hashnode記事URLからhostとslugを抽出する
 *
 * @param url - Hashnode記事のURL（例: https://blog.hashnode.dev/my-article）
 * @returns hostとslugのタプル
 * @throws Error - URLがHashnode記事URLでない場合
 */
function extractHostAndSlug(url: string): [string, string] {
  const parsed = new URL(url);

  if (!isHashnodeHost(parsed.hostname)) {
    throw new Error("HashnodeのURLではありません");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length < MIN_PATH_SEGMENTS) {
    throw new Error("HashnodeのURLからslugを抽出できません");
  }

  const slug = segments[0];

  if (!slug) {
    throw new Error("HashnodeのURLからslugを抽出できません");
  }

  return [parsed.hostname, slug];
}

/**
 * 文字数から読了時間を計算する
 *
 * @param text - 本文テキスト
 * @returns 推定読了時間（分、最小1分）
 */
function calculateReadingTime(text: string): number {
  const charCount = text.length;
  const minutes = Math.ceil(charCount / READING_SPEED_CHARS_PER_MIN);
  return Math.max(minutes, MIN_READING_TIME_MINUTES);
}

/**
 * Hashnode記事URLからGraphQL APIでコンテンツを取得してParsedArticleに変換する
 *
 * hashnode.devおよび*.hashnode.devの両方に対応する。
 * GraphQL APIからtitle, contentMarkdown, author, coverImage, publishedAtを取得する。
 *
 * @param url - Hashnode記事のURL（例: https://blog.hashnode.dev/my-article）
 * @returns パースされた記事情報
 * @throws Error - URLの解析、API取得、またはパースに失敗した場合
 */
export async function parseHashnode(url: string): Promise<ParsedArticle> {
  const [host, slug] = extractHostAndSlug(url);

  const response = await fetch(HASHNODE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      query: HASHNODE_POST_QUERY,
      variables: { host, slug },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Hashnode GraphQL APIからのデータ取得に失敗しました（ステータス: ${response.status}）`,
    );
  }

  const result = (await response.json()) as HashnodeGraphqlResponse;

  const post = result.data.publication?.post;

  if (!post) {
    throw new Error("Hashnode記事が見つかりません");
  }

  const content = post.contentMarkdown;
  const plainText = content.replace(/[#*`[\]()>\-_~|]/g, "").replace(/\n+/g, " ");

  return {
    title: post.title,
    author: post.author.name,
    content,
    excerpt: null,
    thumbnailUrl: post.coverImage?.url ?? null,
    readingTimeMinutes: calculateReadingTime(plainText),
    publishedAt: post.publishedAt,
    source: HASHNODE_SOURCE,
  };
}
