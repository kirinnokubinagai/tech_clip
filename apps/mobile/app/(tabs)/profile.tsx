import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import type { ProfileHeaderUser } from "@/components/ProfileHeader";
import { ProfileHeader } from "@/components/ProfileHeader";
import { DARK_COLORS } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";

/** プライマリカラー */
const PRIMARY_COLOR = DARK_COLORS.primary;

/**
 * 認証済みユーザー情報をプロフィールヘッダー用に変換する
 *
 * bio / followersCount / followingCount は GET /users/me 実装後に反映予定のため、
 * 現在は固定値（null / 0 / 0）を返す。
 *
 * @param user - 認証ストアのユーザー情報
 * @returns プロフィールヘッダー表示用のユーザーオブジェクト
 */
function toProfileHeaderUser(user: { name: string; image: string | null }): ProfileHeaderUser {
  return {
    name: user.name,
    bio: null,
    avatarUrl: user.image,
    followersCount: 0,
    followingCount: 0,
  };
}

/**
 * プロフィール画面
 *
 * 認証状態に応じてユーザー情報またはログイン誘導を表示する。
 * ログイン済みの場合は auth state からユーザー情報を取得して表示する。
 * 未ログインの場合はログイン誘導メッセージとボタンを表示する。
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleSettingsPress = () => {
    router.push("/(tabs)/settings");
  };

  const handleLoginPress = () => {
    router.push("/(auth)/login");
  };

  if (isLoading) {
    return (
      <View testID="profile-loading" className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  if (!isAuthenticated || !user) {
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

  const profileUser = toProfileHeaderUser(user);

  return (
    <ScrollView className="flex-1 bg-background">
      <ProfileHeader user={profileUser} onSettingsPress={handleSettingsPress} />
      <View className="flex-1 items-center justify-center px-4 py-12">
        <Text className="text-base text-text-muted text-center">{t("profile.savedArticles")}</Text>
      </View>
    </ScrollView>
  );
}
