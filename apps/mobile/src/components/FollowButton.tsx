import { UserMinus, UserPlus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { DARK_COLORS } from "@/lib/constants";

/** フォローボタンのアイコンサイズ（px） */
const ICON_SIZE = 16;

/** フォロー済みボタンのアイコンカラー */
const FOLLOWING_ICON_COLOR = DARK_COLORS.text;

/** 未フォローボタンのアイコンカラー */
const NOT_FOLLOWING_ICON_COLOR = DARK_COLORS.white;

/** ローディングインジケーターカラー */
const LOADING_COLOR = DARK_COLORS.primary;

type FollowButtonProps = {
  userId: string;
  isFollowing: boolean;
  onToggle?: (userId: string, isFollowing: boolean) => Promise<void>;
};

/**
 * フォロー/フォロー解除ボタンコンポーネント
 *
 * @param userId - 対象ユーザーのID
 * @param isFollowing - 現在フォロー中かどうか
 * @param onToggle - フォロー状態変更時のコールバック
 */
export function FollowButton({
  userId,
  isFollowing: initialFollowing,
  onToggle,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = useCallback(async () => {
    setIsLoading(true);

    try {
      if (onToggle) {
        await onToggle(userId, isFollowing);
      }
      setIsFollowing((prev) => !prev);
    } catch {
      /* フォロー状態変更失敗時は状態を維持 */
    } finally {
      setIsLoading(false);
    }
  }, [userId, isFollowing, onToggle]);

  if (isLoading) {
    return (
      <Pressable
        testID="follow-button"
        disabled
        className="flex-row items-center justify-center gap-1.5 rounded-lg px-4 py-2 border border-border opacity-50"
        accessibilityRole="button"
        accessibilityLabel="フォロー切り替え中"
      >
        <ActivityIndicator size="small" color={LOADING_COLOR} />
      </Pressable>
    );
  }

  if (isFollowing) {
    return (
      <Pressable
        testID="follow-button"
        onPress={handlePress}
        className="flex-row items-center justify-center gap-1.5 rounded-lg px-4 py-2 border border-border bg-surface"
        accessibilityRole="button"
        accessibilityLabel="フォロー解除"
      >
        <UserMinus size={ICON_SIZE} color={FOLLOWING_ICON_COLOR} />
        <Text testID="follow-button-label" className="text-sm font-medium text-text">
          フォロー中
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID="follow-button"
      onPress={handlePress}
      className="flex-row items-center justify-center gap-1.5 rounded-lg px-4 py-2 bg-primary"
      accessibilityRole="button"
      accessibilityLabel="フォローする"
    >
      <UserPlus size={ICON_SIZE} color={NOT_FOLLOWING_ICON_COLOR} />
      <Text testID="follow-button-label" className="text-sm font-semibold text-white">
        フォローする
      </Text>
    </Pressable>
  );
}
