import { View } from "react-native";

import { Skeleton } from "../Skeleton";

/** 記事リストの1行あたりの高さ */
const ARTICLE_ITEM_HEIGHT = 100;

/** 記事タイトルの高さ */
const TITLE_HEIGHT = 16;

/** 記事メタ情報の高さ */
const META_HEIGHT = 12;

/** デフォルト表示件数 */
const DEFAULT_ITEM_COUNT = 5;

type ArticleListSkeletonProps = {
  count?: number;
};

/**
 * 記事一覧のローディングスケルトン
 *
 * @param count - 表示するスケルトン行数
 */
export function ArticleListSkeleton({ count = DEFAULT_ITEM_COUNT }: ArticleListSkeletonProps) {
  return (
    <View
      className="px-4"
      accessibilityLabel="記事一覧を読み込み中"
      accessibilityHint="しばらくお待ちください"
      accessible={true}
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
          key={`article-skeleton-${index}`}
          testID="article-skeleton"
          className="flex-row gap-3 py-3 border-b border-border"
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        >
          <Skeleton width={ARTICLE_ITEM_HEIGHT} height={ARTICLE_ITEM_HEIGHT} borderRadius={12} />
          <View className="flex-1 justify-center gap-2">
            <Skeleton width="90%" height={TITLE_HEIGHT} />
            <Skeleton width="60%" height={META_HEIGHT} />
            <Skeleton width="40%" height={META_HEIGHT} />
          </View>
        </View>
      ))}
    </View>
  );
}
