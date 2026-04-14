import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { FollowButton } from "@/components/FollowButton";
import { ProfileArticlesSection } from "@/components/ProfileArticlesSection";
import { ProfileHeader } from "@/components/ProfileHeader";
import { useColors } from "@/hooks/use-colors";
import { useFollowToggle, useUserProfile } from "@/hooks/use-user-profile";

/** 戻るアイコンのサイズ（px） */
const BACK_ICON_SIZE = 24;

/** スクロール下部のパディング（px） */
const SCROLL_BOTTOM_PADDING = 40;

/**
 * 他ユーザープロフィール画面
 *
 * 他ユーザーのプロフィール情報を公開プロフィール API から取得して表示する。
 * ProfileHeader コンポーネントを再利用。
 */
export default function UserProfileScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();

  const { data: profile, isLoading, isError, refetch } = useUserProfile(id);

  const { mutateAsync: followToggle } = useFollowToggle();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleFollowToggle = useCallback(
    async (userId: string, currentlyFollowing: boolean) => {
      await followToggle({ userId, isFollowing: currentlyFollowing });
    },
    [followToggle],
  );

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <View
        testID="user-profile-loading"
        className="flex-1 bg-background items-center justify-center"
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-text-muted mt-3">{t("profile.loadingUser")}</Text>
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View
        testID="user-profile-error"
        className="flex-1 bg-background items-center justify-center px-4"
      >
        <Text className="text-text-muted text-base text-center">{t("profile.fetchError")}</Text>
        <Pressable
          onPress={handleRetry}
          className="mt-4 bg-primary rounded-lg px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel={t("common.retry")}
          accessibilityHint={t("profile.retryHint")}
        >
          <Text className="text-white font-semibold">{t("common.retry")}</Text>
        </Pressable>
        <Pressable
          onPress={handleBack}
          className="mt-3"
          accessibilityRole="button"
          accessibilityLabel={t("profile.back")}
          accessibilityHint={t("profile.backHint")}
        >
          <Text className="text-primary">{t("profile.back")}</Text>
        </Pressable>
      </View>
    );
  }

  const profileHeaderUser = {
    name: profile.name ?? "",
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    followersCount: profile.followersCount,
    followingCount: profile.followingCount,
  };

  return (
    <View testID="user-profile-screen" className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-surface border-b border-border">
        <Pressable
          testID="user-profile-back-button"
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t("profile.back")}
          hitSlop={8}
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={colors.text} />
        </Pressable>
        <Text className="text-lg font-bold text-text">{profileHeaderUser.name}</Text>
        <View style={{ width: BACK_ICON_SIZE }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
      >
        <ProfileHeader user={profileHeaderUser} />

        <View testID="user-profile-follow-section" className="px-4 py-4">
          <FollowButton
            userId={id}
            isFollowing={profile.isFollowing}
            onToggle={handleFollowToggle}
          />
        </View>

        <ProfileArticlesSection mode="public" userId={id} />
      </ScrollView>
    </View>
  );
}
