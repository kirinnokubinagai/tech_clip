import type { ArticleSource } from "@/types/article";

export type SourceDefinition = {
  id: ArticleSource;
  label: string;
  badgeClassName: string;
};

export const SOURCE_DEFINITIONS = [
  { id: "zenn", label: "Zenn", badgeClassName: "bg-blue-500/20 text-blue-400" },
  { id: "qiita", label: "Qiita", badgeClassName: "bg-green-500/20 text-green-400" },
  { id: "note", label: "note", badgeClassName: "bg-emerald-500/20 text-emerald-400" },
  { id: "hatena", label: "はてな", badgeClassName: "bg-sky-500/20 text-sky-400" },
  { id: "devto", label: "dev.to", badgeClassName: "bg-gray-500/20 text-gray-300" },
  { id: "medium", label: "Medium", badgeClassName: "bg-neutral-500/20 text-neutral-300" },
  {
    id: "hackernews",
    label: "Hacker News",
    badgeClassName: "bg-orange-500/20 text-orange-400",
  },
  { id: "hashnode", label: "Hashnode", badgeClassName: "bg-indigo-500/20 text-indigo-400" },
  { id: "github", label: "GitHub", badgeClassName: "bg-zinc-500/20 text-zinc-300" },
  {
    id: "stackoverflow",
    label: "Stack Overflow",
    badgeClassName: "bg-red-500/20 text-red-400",
  },
  { id: "reddit", label: "Reddit", badgeClassName: "bg-orange-600/20 text-orange-400" },
  {
    id: "speakerdeck",
    label: "Speaker Deck",
    badgeClassName: "bg-teal-500/20 text-teal-400",
  },
  {
    id: "freecodecamp",
    label: "freeCodeCamp",
    badgeClassName: "bg-cyan-500/20 text-cyan-400",
  },
  {
    id: "logrocket",
    label: "LogRocket",
    badgeClassName: "bg-pink-500/20 text-pink-400",
  },
  {
    id: "css-tricks",
    label: "CSS-Tricks",
    badgeClassName: "bg-fuchsia-500/20 text-fuchsia-400",
  },
  {
    id: "smashing",
    label: "Smashing Magazine",
    badgeClassName: "bg-rose-500/20 text-rose-400",
  },
  {
    id: "youtube",
    label: "YouTube",
    badgeClassName: "bg-red-600/20 text-red-500",
  },
  { id: "other", label: "その他", badgeClassName: "bg-stone-500/20 text-stone-300" },
] as const satisfies readonly SourceDefinition[];

export const SOURCE_CONFIG: Record<ArticleSource, SourceDefinition> = SOURCE_DEFINITIONS.reduce(
  (config, source) => {
    config[source.id] = source;
    return config;
  },
  {} as Record<ArticleSource, SourceDefinition>,
);

export const SUPPORTED_SOURCES = SOURCE_DEFINITIONS.map(({ id }) => id) as readonly ArticleSource[];

export const SUPPORTED_SOURCE_COUNT = SOURCE_DEFINITIONS.length;

export function getSourceDefinition(source: ArticleSource): SourceDefinition {
  return SOURCE_CONFIG[source] ?? SOURCE_CONFIG.other;
}
