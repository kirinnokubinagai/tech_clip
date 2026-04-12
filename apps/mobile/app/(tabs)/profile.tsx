import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import type { ProfileHeaderUser } from "@/components/ProfileHeader";
import { ProfileHeader } from "@/components/ProfileHeader";
import { DARK_COLORS } from "@/lib/constants";
import { useAuthStore } from "@/stores/auth-store";

/** プライマリカラー */
const PRIMARY_COLOR = DARK_COLORS.primary;

/**
 * プロフィール画面
 *
 * 認証済みユーザーのプロフィール情報を表示する。
 * 未認証時はゲスト表示またはローディング表示を返す。
 */
export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);

  const handleSettingsPress = () => {
    router.push("/(tabs)/settings");
  };

  if (isLoading) {
    return (
      <View testID="profile-loading" className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  if (!user) {
    return (
      <View
        testID="profile-guest"
        className="flex-1 items-center justify-center px-4 bg-background"
      >
        <Text className="text-base text-text-muted text-center">
          ログインすると保存した記事やお気に入りが表示されます
        </Text>
      </View>
    );
  }

  const profileUser: ProfileHeaderUser = {
    name: user.name,
    bio: null,
    avatarUrl: user.image,
    followersCount: undefined, // TODO: 認証ユーザーのフォロワー数はAPIから取得予定
    followingCount: undefined, // TODO: 認証ユーザーのフォロー数はAPIから取得予定
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <ProfileHeader user={profileUser} onSettingsPress={handleSettingsPress} />
      <View className="flex-1 items-center justify-center px-4 py-12">
        <Text className="text-base text-text-muted text-center">
          保存した記事やお気に入りがここに表示されます
        </Text>
      </View>
    </ScrollView>
  );
}
