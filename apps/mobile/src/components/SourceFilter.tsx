import * as Haptics from "expo-haptics";
import { ScrollView, Text } from "react-native";
import { Pressable } from "react-native";

import type { ArticleSource, SourceFilterOption } from "@/types/article";

/** フィルター選択肢 */
const FILTER_OPTIONS: SourceFilterOption[] = [
  { label: "すべて", value: null },
  { label: "Zenn", value: "zenn" },
  { label: "Qiita", value: "qiita" },
  { label: "note", value: "note" },
  { label: "Hatena", value: "hatena" },
  { label: "DEV", value: "devto" },
  { label: "Medium", value: "medium" },
  { label: "HN", value: "hackernews" },
  { label: "GitHub", value: "github" },
];

type SourceFilterProps = {
  selected: ArticleSource | null;
  onSelect: (source: ArticleSource | null) => void;
};

/** アクティブチップのスタイル */
const ACTIVE_CHIP_STYLE = "bg-primary border-primary";

/** 非アクティブチップのスタイル */
const INACTIVE_CHIP_STYLE = "bg-surface border-border";

/** アクティブテキストのスタイル */
const ACTIVE_TEXT_STYLE = "text-white font-semibold";

/** 非アクティブテキストのスタイル */
const INACTIVE_TEXT_STYLE = "text-text-muted";

/**
 * ソースフィルターチップ群コンポーネント
 *
 * 横スクロール可能なチップ群で記事のソースをフィルターする。
 *
 * @param selected - 現在選択中のソース（nullの場合は「すべて」）
 * @param onSelect - ソース選択時のコールバック
 */
export function SourceFilter({ selected, onSelect }: SourceFilterProps) {
  /**
   * チップ押下時のハンドラ
   */
  function handleSelect(value: ArticleSource | null) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(value);
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      className="py-3"
    >
      {FILTER_OPTIONS.map((option) => {
        const isActive = selected === option.value;

        return (
          <Pressable
            key={option.value ?? "all"}
            onPress={() => handleSelect(option.value)}
            className={`rounded-full border px-4 py-1.5 ${isActive ? ACTIVE_CHIP_STYLE : INACTIVE_CHIP_STYLE}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${option.label}でフィルター`}
          >
            <Text className={`text-sm ${isActive ? ACTIVE_TEXT_STYLE : INACTIVE_TEXT_STYLE}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
