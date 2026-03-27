import { View } from "react-native";

import { Skeleton } from "../Skeleton";

/** アバターサイズ */
const AVATAR_SIZE = 80;

/** 名前テキストの高さ */
const NAME_HEIGHT = 20;

/** メールテキストの高さ */
const EMAIL_HEIGHT = 14;

/** 統計値の高さ */
const STAT_HEIGHT = 32;

/** 統計値の幅 */
const STAT_WIDTH = 60;

/**
 * プロフィール画面のローディングスケルトン
 */
export function ProfileSkeleton() {
  return (
    <View className="items-center px-4 pt-8">
      <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={40} />
      <Skeleton width={120} height={NAME_HEIGHT} className="mt-4" />
      <Skeleton width={180} height={EMAIL_HEIGHT} className="mt-2" />
      <View className="flex-row gap-8 mt-6">
        <Skeleton width={STAT_WIDTH} height={STAT_HEIGHT} />
        <Skeleton width={STAT_WIDTH} height={STAT_HEIGHT} />
        <Skeleton width={STAT_WIDTH} height={STAT_HEIGHT} />
      </View>
    </View>
  );
}
