import { View } from "react-native";

import { Skeleton } from "../Skeleton";

/** ヘッダー画像の高さ */
const HEADER_IMAGE_HEIGHT = 200;

/** タイトルの高さ */
const TITLE_HEIGHT = 24;

/** 本文1行の高さ */
const BODY_LINE_HEIGHT = 14;

/** 本文行数 */
const BODY_LINE_COUNT = 8;

/**
 * 記事詳細画面のローディングスケルトン
 */
export function ArticleDetailSkeleton() {
  return (
    <View className="px-4">
      <Skeleton width="100%" height={HEADER_IMAGE_HEIGHT} borderRadius={12} />
      <Skeleton width="90%" height={TITLE_HEIGHT} className="mt-4" />
      <Skeleton width="60%" height={TITLE_HEIGHT} className="mt-2" />
      <View className="flex-row gap-2 mt-4">
        <Skeleton width={80} height={20} borderRadius={12} />
        <Skeleton width={100} height={20} borderRadius={12} />
      </View>
      <View className="mt-6 gap-2">
        {Array.from({ length: BODY_LINE_COUNT }, (_, index) => (
          <Skeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
            key={`body-line-${index}`}
            width={index === BODY_LINE_COUNT - 1 ? "70%" : "100%"}
            height={BODY_LINE_HEIGHT}
          />
        ))}
      </View>
    </View>
  );
}
