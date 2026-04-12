import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { FollowButton } from "@/components/FollowButton";
import { ProfileHeader } from "@/components/ProfileHeader";
import { useUserProfile } from "@/hooks/use-user-profile";
import { DARK_COLORS } from "@/lib/constants";

/** 戻るアイコンのサイズ（px） */
const BACK_ICON_SIZE = 24;

/** テキストカラー */
const TEXT_COLOR = DARK_COLORS.text;

/** プライマリカラー */
const PRIMARY_COLOR = DARK_COLORS.primary;

/**
 * 他ユーザープロフィール画面
 *
 * 他ユーザーのプロフィール情報を公開プロフィール API から取得して表示する。
 * ProfileHeader コンポーネントを再利用。
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: profile, isLoading, isError, refetch } = useUserProfile(id);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleFollowToggle = useCallback(async (_userId: string, _currentlyFollowing: boolean) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  }, []);

  if (isLoading) {
    return (
      <View
        testID="user-profile-loading"
        className="flex-1 bg-background items-center justify-center"
      >
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text className="text-text-muted mt-3">読み込み中...</Text>
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View
        testID="user-profile-error"
        className="flex-1 bg-background items-center justify-center px-4"
      >
        <Text className="text-text-muted text-base text-center">
          ユーザー情報の取得に失敗しました
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="mt-4 bg-primary rounded-lg px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel="再試行"
          accessibilityHint="ユーザー情報の取得を再試行します"
        >
          <Text className="text-white font-semibold">再試行</Text>
        </Pressable>
        <Pressable
          onPress={handleBack}
          className="mt-3"
          accessibilityRole="button"
          accessibilityLabel="戻る"
          accessibilityHint="前の画面に戻ります"
        >
          <Text className="text-primary">戻る</Text>
        </Pressable>
      </View>
    );
  }

  const profileHeaderUser = {
    name: profile.name ?? profile.username ?? "",
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
          accessibilityLabel="戻る"
          hitSlop={8}
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={TEXT_COLOR} />
        </Pressable>
        <Text className="text-lg font-bold text-text">{profileHeaderUser.name}</Text>
        <View style={{ width: BACK_ICON_SIZE }} />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <ProfileHeader user={profileHeaderUser} />

        <View testID="user-profile-follow-section" className="px-4 py-4">
          <FollowButton userId={id} isFollowing={false} onToggle={handleFollowToggle} />
        </View>

        <View className="px-4">
          <View className="border-t border-border pt-4">
            <Text className="text-base font-semibold text-text mb-3">保存した記事</Text>
            <View className="items-center py-8">
              <Text className="text-text-muted text-sm text-center">
                このユーザーの公開記事はまだありません
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
