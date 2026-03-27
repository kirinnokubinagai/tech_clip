import { Text, View } from "react-native";

import { Badge } from "@/components/ui";
import type { ArticleSource } from "@/types/article";

type ArticleDetailHeaderProps = {
  title: string;
  source: ArticleSource;
  author: string | null;
  publishedAt: string | null;
};

/** 日付フォーマット用オプション */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/**
 * 日付文字列を表示用にフォーマットする
 *
 * @param dateString - ISO 8601形式の日付文字列
 * @returns フォーマット済みの日付文字列
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", DATE_FORMAT_OPTIONS);
}

/**
 * 記事詳細画面のヘッダーコンポーネント
 * タイトル、ソースバッジ、著者名、公開日を表示する
 *
 * @param title - 記事タイトル
 * @param source - 記事ソース（zenn, qiitaなど）
 * @param author - 著者名（nullの場合は非表示）
 * @param publishedAt - 公開日（nullの場合は非表示）
 */
export function ArticleDetailHeader({
  title,
  source,
  author,
  publishedAt,
}: ArticleDetailHeaderProps) {
  return (
    <View className="mb-4">
      <View className="flex-row items-center gap-2 mb-3">
        <Badge>{source}</Badge>
        {publishedAt && <Text className="text-text-muted text-sm">{formatDate(publishedAt)}</Text>}
      </View>

      <Text className="text-text text-2xl font-bold leading-tight mb-2">{title}</Text>

      {author && <Text className="text-text-muted text-sm">{author}</Text>}
    </View>
  );
}
