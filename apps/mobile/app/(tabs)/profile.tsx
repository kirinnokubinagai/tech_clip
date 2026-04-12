import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import type { ProfileHeaderUser } from "@/components/ProfileHeader";
import { ProfileHeader } from "@/components/ProfileHeader";

/**
 * プロフィール画面
 *
 * 自分のプロフィール情報を表示する。
 * 認証実装後にAPIからユーザーデータを取得する予定。
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  /** プロフィール画面のプレースホルダーユーザーデータ */
  const PLACEHOLDER_USER: ProfileHeaderUser = {
    name: t("profile.guestUser"),
    bio: null,
    avatarUrl: null,
    followersCount: 0,
    followingCount: 0,
  };

  const handleSettingsPress = () => {
    router.push("/(tabs)/settings");
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <ProfileHeader user={PLACEHOLDER_USER} onSettingsPress={handleSettingsPress} />
      <View className="flex-1 items-center justify-center px-4 py-12">
        <Text className="text-base text-text-muted text-center">{t("profile.loginPrompt")}</Text>
      </View>
    </ScrollView>
  );
}
