import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ProfileArticlesSection } from "@/components/ProfileArticlesSection";
import { ProfileHeader } from "@/components/ProfileHeader";
import { useColors } from "@/hooks/use-colors";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useAuthStore } from "@/stores/auth-store";

/**
 * プロフィール画面
 *
 * 認証状態に応じてユーザー情報またはログイン誘導を表示する。
 * ログイン済みの場合は GET /api/users/me からプロフィールを取得して表示する。
 * 未ログインの場合はログイン誘導メッセージとボタンを表示する。
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  const { data: meProfile, isLoading: isProfileLoading } = useMyProfile();

  /** 設定画面への遷移を処理する */
  const handleSettingsPress = () => {
    router.push("/(tabs)/settings");
  };

  const handleLoginPress = () => {
    router.push("/(auth)/login");
  };

  if (isAuthLoading || (isAuthenticated && isProfileLoading)) {
    return (
      <View testID="profile-loading" className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScrollView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-4 py-20">
          <Text
            testID="profile-guest-message"
            className="text-base text-text-muted text-center mb-6"
          >
            {t("profile.loginPrompt")}
          </Text>
          <Pressable
            testID="profile-login-button"
            onPress={handleLoginPress}
            className="bg-primary rounded-lg px-8 py-3"
            accessibilityRole="button"
            accessibilityLabel={t("auth.login")}
          >
            <Text className="text-white font-semibold text-base">{t("auth.login")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const profileHeaderUser = meProfile
    ? {
        name: meProfile.name ?? "",
        bio: meProfile.bio ?? null,
        avatarUrl: meProfile.avatarUrl ?? null,
        followersCount: meProfile.followersCount,
        followingCount: meProfile.followingCount,
      }
    : null;

  return (
    <ScrollView className="flex-1 bg-background">
      {profileHeaderUser && (
        <ProfileHeader user={profileHeaderUser} onSettingsPress={handleSettingsPress} />
      )}
      <ProfileArticlesSection mode="saved" enabled={isAuthenticated} />
    </ScrollView>
  );
}
