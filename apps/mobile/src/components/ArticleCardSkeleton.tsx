import { View } from "react-native";

import { Skeleton } from "@/components/ui";

/** サムネイルスケルトン高さ */
const THUMBNAIL_SKELETON_HEIGHT = 160;

/** タイトルスケルトン高さ */
const TITLE_SKELETON_HEIGHT = 20;

/** バッジスケルトン幅 */
const BADGE_SKELETON_WIDTH = 60;

/** バッジスケルトン高さ */
const BADGE_SKELETON_HEIGHT = 20;

/** エクサープトスケルトン高さ */
const EXCERPT_SKELETON_HEIGHT = 16;

/** アクションスケルトンサイズ */
const ACTION_SKELETON_SIZE = 24;

/** スケルトンリストのデフォルト件数 */
const DEFAULT_SKELETON_COUNT = 3;

/**
 * 記事カードのスケルトンコンポーネント
 *
 * ローディング中に表示するプレースホルダー
 */
export function ArticleCardSkeleton() {
  return (
    <View className="bg-card rounded-xl border border-border overflow-hidden mb-3">
      <Skeleton width="100%" height={THUMBNAIL_SKELETON_HEIGHT} borderRadius={0} />

      <View className="p-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Skeleton width={BADGE_SKELETON_WIDTH} height={BADGE_SKELETON_HEIGHT} borderRadius={12} />
          <Skeleton width={BADGE_SKELETON_WIDTH} height={BADGE_SKELETON_HEIGHT} borderRadius={12} />
        </View>

        <Skeleton width="90%" height={TITLE_SKELETON_HEIGHT} className="mb-1" />
        <Skeleton width="70%" height={TITLE_SKELETON_HEIGHT} className="mb-2" />

        <Skeleton width="100%" height={EXCERPT_SKELETON_HEIGHT} className="mb-1" />
        <Skeleton width="80%" height={EXCERPT_SKELETON_HEIGHT} className="mb-3" />

        <View className="flex-row items-center justify-between">
          <Skeleton width={ACTION_SKELETON_SIZE} height={ACTION_SKELETON_SIZE} borderRadius={12} />
          <Skeleton width={ACTION_SKELETON_SIZE} height={ACTION_SKELETON_SIZE} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

/**
 * 記事カードスケルトンリストを生成する
 *
 * @param count - 表示するスケルトン数
 * @returns スケルトンリスト
 */
export function ArticleCardSkeletonList({ count = DEFAULT_SKELETON_COUNT }: { count?: number }) {
  return (
    <View className="px-4">
      {Array.from({ length: count }, (_, i) => (
        <ArticleCardSkeleton key={`skeleton-${String(i)}`} />
      ))}
    </View>
  );
}
