import { Text, View } from "react-native";

/** 対応する18サイトのソース名 */
export type SourceName =
  | "zenn"
  | "qiita"
  | "hatena"
  | "note"
  | "dev_to"
  | "medium"
  | "hacker_news"
  | "techcrunch"
  | "the_verge"
  | "wired"
  | "ars_technica"
  | "github_blog"
  | "product_hunt"
  | "reddit"
  | "lobsters"
  | "publickey"
  | "gihyo"
  | "itmedia";

/** バッジのサイズバリアント */
type BadgeSize = "sm" | "md";

type SourceBadgeProps = {
  source: SourceName;
  size?: BadgeSize;
};

type SourceConfig = {
  label: string;
  color: string;
};

/** 各ソースの表示名と色の設定 */
export const SOURCE_CONFIG: Record<SourceName, SourceConfig> = {
  zenn: { label: "Zenn", color: "bg-blue-500/20 text-blue-400" },
  qiita: { label: "Qiita", color: "bg-green-500/20 text-green-400" },
  hatena: { label: "はてな", color: "bg-sky-500/20 text-sky-400" },
  note: { label: "note", color: "bg-emerald-500/20 text-emerald-400" },
  dev_to: { label: "DEV", color: "bg-gray-500/20 text-gray-300" },
  medium: { label: "Medium", color: "bg-neutral-500/20 text-neutral-300" },
  hacker_news: { label: "Hacker News", color: "bg-orange-500/20 text-orange-400" },
  techcrunch: { label: "TechCrunch", color: "bg-lime-500/20 text-lime-400" },
  the_verge: { label: "The Verge", color: "bg-fuchsia-500/20 text-fuchsia-400" },
  wired: { label: "WIRED", color: "bg-zinc-500/20 text-zinc-300" },
  ars_technica: { label: "Ars Technica", color: "bg-red-500/20 text-red-400" },
  github_blog: { label: "GitHub Blog", color: "bg-purple-500/20 text-purple-400" },
  product_hunt: { label: "Product Hunt", color: "bg-amber-500/20 text-amber-400" },
  reddit: { label: "Reddit", color: "bg-orange-600/20 text-orange-400" },
  lobsters: { label: "Lobsters", color: "bg-rose-500/20 text-rose-400" },
  publickey: { label: "Publickey", color: "bg-teal-500/20 text-teal-400" },
  gihyo: { label: "gihyo.jp", color: "bg-indigo-500/20 text-indigo-400" },
  itmedia: { label: "ITmedia", color: "bg-cyan-500/20 text-cyan-400" },
};

/** サイズごとのスタイル */
const SIZE_STYLES: Record<BadgeSize, { container: string; text: string }> = {
  sm: { container: "px-2 py-0.5", text: "text-xs" },
  md: { container: "px-2.5 py-1", text: "text-sm" },
};

/**
 * 記事のソースサイトを表示するバッジコンポーネント
 *
 * @param source - ソースサイト名（18サイト対応）
 * @param size - バッジサイズ（デフォルト: sm）
 */
export function SourceBadge({ source, size = "sm" }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <View
      testID="source-badge"
      className={`rounded-full self-start ${sizeStyle.container} ${config.color.split(" ")[0]}`}
      accessibilityLabel={config.label}
    >
      <Text className={`font-medium ${sizeStyle.text} ${config.color.split(" ")[1]}`}>
        {config.label}
      </Text>
    </View>
  );
}
