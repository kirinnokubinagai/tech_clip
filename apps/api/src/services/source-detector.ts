import type { ArticleSource } from "@tech-clip/types";

/** ソースマッピングの型定義 */
type SourceMapping = {
  pattern: RegExp;
  source: ArticleSource;
};

/** Zennブック判定パターン */
const ZENN_BOOKS_PATTERN = /^zenn\.dev\/.*\/books\//;

/** Zenn判定パターン */
const ZENN_PATTERN = /^zenn\.dev/;

/** Qiita判定パターン */
const QIITA_PATTERN = /^qiita\.com/;

/** note判定パターン */
const NOTE_PATTERN = /^note\.com/;

/** はてなブログ判定パターン */
const HATENA_PATTERN = /^.*\.hatenablog\.(com|jp)|.*\.hateblo\.jp/;

/** SpeakerDeck判定パターン */
const SPEAKERDECK_PATTERN = /^speakerdeck\.com/;

/** Dev.to判定パターン */
const DEVTO_PATTERN = /^dev\.to/;

/** Medium判定パターン */
const MEDIUM_PATTERN = /^(.*\.)?medium\.com/;

/** Hacker News判定パターン */
const HACKERNEWS_PATTERN = /^news\.ycombinator\.com/;

/** Hashnode判定パターン */
const HASHNODE_PATTERN = /^hashnode\.com|.*\.hashnode\.dev/;

/** GitHub判定パターン */
const GITHUB_PATTERN = /^github\.com/;

/** Stack Overflow判定パターン */
const STACKOVERFLOW_PATTERN = /^stackoverflow\.com/;

/** Reddit判定パターン */
const REDDIT_PATTERN = /^(.*\.)?reddit\.com/;

/** freeCodeCamp判定パターン */
const FREECODECAMP_PATTERN = /^(www\.)?freecodecamp\.org/;

/** LogRocket判定パターン */
const LOGROCKET_PATTERN = /^blog\.logrocket\.com/;

/** CSS-Tricks判定パターン */
const CSS_TRICKS_PATTERN = /^css-tricks\.com/;

/** Smashing Magazine判定パターン */
const SMASHING_PATTERN = /^(www\.)?smashingmagazine\.com/;

/** URLホスト+パスとArticleSourceの対応表 */
const SOURCE_MAPPINGS: SourceMapping[] = [
  { pattern: ZENN_BOOKS_PATTERN, source: "zenn" },
  { pattern: ZENN_PATTERN, source: "zenn" },
  { pattern: QIITA_PATTERN, source: "qiita" },
  { pattern: NOTE_PATTERN, source: "note" },
  { pattern: HATENA_PATTERN, source: "hatena" },
  { pattern: SPEAKERDECK_PATTERN, source: "speakerdeck" },
  { pattern: DEVTO_PATTERN, source: "devto" },
  { pattern: MEDIUM_PATTERN, source: "medium" },
  { pattern: HACKERNEWS_PATTERN, source: "hackernews" },
  { pattern: HASHNODE_PATTERN, source: "hashnode" },
  { pattern: GITHUB_PATTERN, source: "github" },
  { pattern: STACKOVERFLOW_PATTERN, source: "stackoverflow" },
  { pattern: REDDIT_PATTERN, source: "reddit" },
  { pattern: FREECODECAMP_PATTERN, source: "freecodecamp" },
  { pattern: LOGROCKET_PATTERN, source: "logrocket" },
  { pattern: CSS_TRICKS_PATTERN, source: "css-tricks" },
  { pattern: SMASHING_PATTERN, source: "smashing" },
];

/**
 * URLからArticleSourceを自動判定する
 *
 * @param url - 判定対象のURL文字列
 * @returns 判定されたArticleSource。該当なしの場合は"other"
 */
export function detectSource(url: string): ArticleSource {
  const parsed = new URL(url);
  const hostAndPath = parsed.hostname + parsed.pathname;

  for (const { pattern, source } of SOURCE_MAPPINGS) {
    if (pattern.test(hostAndPath)) {
      return source;
    }
  }
  return "other";
}
