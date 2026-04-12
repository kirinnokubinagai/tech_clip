import { UserMinus, UserPlus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { DARK_COLORS } from "@/lib/constants";

/** フォローボタンのアイコンサイズ（px） */
const ICON_SIZE = 16;

/** フォロー済みボタンのアイコンカラー */
const FOLLOWING_ICON_COLOR = DARK_COLORS.text;

/** 未フォローボタンのアイコンカラー */
const NOT_FOLLOWING_ICON_COLOR = DARK_COLORS.white;

/** フォロー済みブランチのローディングインジケーターカラー */
const FOLLOWING_LOADING_COLOR = DARK_COLORS.primary;

/** 未フォローブランチのローディングインジケーターカラー（白: 青背景上で視認可能） */
const NOT_FOLLOWING_LOADING_COLOR = DARK_COLORS.white;

type FollowButtonProps = {
  userId: string;
  isFollowing: boolean;
  onToggle?: (userId: string, isFollowing: boolean) => Promise<void>;
};

/**
 * フォロー/フォロー解除ボタンコンポーネント
 *
 * 楽観更新: ボタン押下直後にUIを更新し、API完了を待たない。
 * API失敗時は元の状態にロールバックする。
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
  const { t } = useTranslation();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = useCallback(async () => {
    const prevFollowing = isFollowing;

    setIsLoading(true);
    setIsFollowing(!prevFollowing);

    try {
      if (onToggle) {
        await onToggle(userId, prevFollowing);
      }
    } catch {
      setIsFollowing(prevFollowing);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isFollowing, onToggle]);

  if (isFollowing) {
    return (
      <Pressable
        testID="follow-button"
        onPress={handlePress}
        disabled={isLoading}
        accessibilityState={{ disabled: isLoading }}
        className="flex-row items-center justify-center gap-1.5 rounded-lg px-4 py-2 border border-border bg-surface"
        style={isLoading ? { opacity: 0.5 } : undefined}
        accessibilityRole="button"
        accessibilityLabel={
          isLoading ? t("common.accessibility.followSwitching") : t("common.accessibility.unfollow")
        }
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={FOLLOWING_LOADING_COLOR} />
        ) : (
          <UserMinus size={ICON_SIZE} color={FOLLOWING_ICON_COLOR} />
        )}
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
      disabled={isLoading}
      accessibilityState={{ disabled: isLoading }}
      className="flex-row items-center justify-center gap-1.5 rounded-lg px-4 py-2 bg-primary"
      style={isLoading ? { opacity: 0.5 } : undefined}
      accessibilityRole="button"
      accessibilityLabel={
        isLoading ? t("common.accessibility.followSwitching") : t("common.accessibility.follow")
      }
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={NOT_FOLLOWING_LOADING_COLOR} />
      ) : (
        <UserPlus size={ICON_SIZE} color={NOT_FOLLOWING_ICON_COLOR} />
      )}
      <Text testID="follow-button-label" className="text-sm font-semibold text-white">
        フォローする
      </Text>
    </Pressable>
  );
}
