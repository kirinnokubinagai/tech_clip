/**
 * 全 source parser の動作確認スクリプト
 *
 * 各 source ごとに実 URL を 1 件ずつ parseArticle で解析し、
 * title / content / author / source が取れるか確認する。
 *
 * 実行: pnpm tsx scripts/verify-all-sources.ts
 */
import { parseArticle } from "../src/services/article-parser";

type TestCase = { source: string; url: string };

const CASES: TestCase[] = [
  { source: "zenn", url: "https://zenn.dev/coji/articles/cloudflare-d1-fts5-japanese-search-api" },
  {
    source: "zenn-book",
    url: "https://zenn.dev/mizchi/books/typescript-for-beginner/viewer/hello-typescript",
  },
  { source: "qiita", url: "https://qiita.com/miruky/items/fde2d0747358cd7870d7" },
  { source: "note", url: "https://note.com/kenshirasu/n/n1aef2a7bd4ab" },
  { source: "hatena", url: "https://developer.hatenablog.com/entry/2024/04/01/120000" },
  { source: "devto", url: "https://dev.to/devteam/welcome-to-dev-4lla" },
  {
    source: "medium",
    url: "https://medium.com/better-programming/10-modern-css-techniques-for-older-css-problems-722e7141099e",
  },
  { source: "hackernews", url: "https://news.ycombinator.com/item?id=41234567" },
  {
    source: "hashnode",
    url: "https://kentcdodds.hashnode.dev/what-is-useevent-and-why-should-you-care",
  },
  { source: "github", url: "https://github.com/google/magika" },
  { source: "stackoverflow", url: "https://ja.stackoverflow.com/questions/89408" },
  {
    source: "reddit",
    url: "https://www.reddit.com/r/programming/comments/1e91sgo/rust_is_now_part_of_the_linux_kernel/",
  },
  {
    source: "freecodecamp",
    url: "https://www.freecodecamp.org/news/how-javascript-works-in-browser-and-node/",
  },
  {
    source: "logrocket",
    url: "https://blog.logrocket.com/react-server-components-a-comprehensive-guide/",
  },
  { source: "css-tricks", url: "https://css-tricks.com/a-complete-guide-to-css-functions/" },
  {
    source: "smashing",
    url: "https://www.smashingmagazine.com/2024/06/accessible-mobile-tab-navigation-on-ios/",
  },
  { source: "twitter", url: "https://x.com/dan_abramov/status/1850000000000000000" },
  { source: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  {
    source: "speakerdeck",
    url: "https://speakerdeck.com/line_developers/ui-kit-and-design-system",
  },
  { source: "other-generic", url: "https://blog.cloudflare.com/workers-ai/" },
];

async function main() {
  const results: Array<{ source: string; url: string; pass: boolean; detail: string }> = [];

  for (const tc of CASES) {
    const label = `${tc.source.padEnd(14)} ${tc.url.slice(0, 60)}`;
    try {
      const parsed = await parseArticle(tc.url);
      const hasTitle = !!parsed.title;
      const contentLen = parsed.content?.length ?? 0;
      const pass = hasTitle;
      const detail = `title=${hasTitle ? "OK" : "NO"} content=${contentLen}chars author=${parsed.author ?? "-"}`;
      results.push({ source: tc.source, url: tc.url, pass, detail });
      process.stdout.write(`${pass ? "✓" : "✗"} ${label} ${detail}\n`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ source: tc.source, url: tc.url, pass: false, detail: `ERROR: ${msg}` });
      process.stdout.write(`✗ ${label} ERROR: ${msg.slice(0, 80)}\n`);
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  process.stdout.write(`\n=== ${passed}/${total} sources parse OK ===\n`);
  for (const r of results.filter((r) => !r.pass)) {
    process.stdout.write(`  FAIL: ${r.source} ${r.detail}\n`);
  }
}

main().catch((e) => {
  process.stderr.write(`${e}\n`);
  process.exit(1);
});
