import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { FollowButton } from "@/components/FollowButton";
import { ProfileHeader } from "@/components/ProfileHeader";
import { useColors } from "@/hooks/use-colors";
import { useFollowToggle, useUserProfile } from "@/hooks/use-user-profile";

/** 戻るアイコンのサイズ（px） */
const BACK_ICON_SIZE = 24;

/**
 * 他ユーザープロフィール画面
 *
 * 他ユーザーのプロフィール情報を表示し、フォローボタンを提供する。
 * ProfileHeaderコンポーネントを再利用。
 */
export default function UserProfileScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();

  const { data: user, isLoading, isError, refetch } = useUserProfile(id);

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

  if (isError || !user) {
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
        <Text className="text-lg font-bold text-text">{user.name}</Text>
        <View style={{ width: BACK_ICON_SIZE }} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <ProfileHeader user={user} />

        <View testID="user-profile-follow-section" className="px-4 py-4">
          <FollowButton userId={id} isFollowing={user.isFollowing} onToggle={handleFollowToggle} />
        </View>

        <View className="px-4">
          <View className="border-t border-border pt-4">
            <Text className="text-base font-semibold text-text mb-3">
              {t("profile.savedArticles")}
            </Text>
            <View className="items-center py-8">
              <Text className="text-text-muted text-sm text-center">
                {t("profile.noPublicArticles")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
