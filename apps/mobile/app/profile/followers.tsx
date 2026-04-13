import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { FollowUser } from "@/hooks/use-follow";
import { useFollowers, useFollowing } from "@/hooks/use-follow";
import { getInitials } from "@/utils/formatters";

/** タブの種類 */
type TabType = "followers" | "following";

/** 戻るアイコンのサイズ（px） */
const BACK_ICON_SIZE = 24;

/** アバターのサイズ（px） */
const AVATAR_SIZE = 48;

type UserListItemProps = {
  item: FollowUser;
  onPress: (userId: string) => void;
  userProfileLabel: string;
};

/**
 * ユーザーリストアイテムコンポーネント
 *
 * @param item - 表示するユーザーデータ
 * @param onPress - タップ時のコールバック
 * @param userProfileLabel - アクセシビリティラベル（翻訳済み文字列）
 */
function UserListItem({ item, onPress, userProfileLabel }: UserListItemProps) {
  const colors = useColors();
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable
      testID={`user-item-${item.id}`}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={userProfileLabel}
      className="flex-row items-center gap-3 px-4 py-3 border-b border-border"
    >
      {item.avatarUrl ? (
        <Image
          source={{ uri: item.avatarUrl }}
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            backgroundColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            {getInitials(item.name)}
          </Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-base font-semibold text-text">{item.name}</Text>
        {item.bio && (
          <Text className="text-sm text-text-muted mt-0.5" numberOfLines={1}>
            {item.bio}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/**
 * フォロワー/フォロー中一覧画面
 *
 * タブで切り替え可能。ユーザーアイテムをタップするとプロフィール画面へ遷移。
 * クエリパラメータ `tab` で初期タブを指定可能（"followers" | "following"）。
 */
export default function FollowersScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();

  const initialTab: TabType = tab === "following" ? "following" : "followers";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const {
    data: followersData,
    isLoading: isFollowersLoading,
    isError: isFollowersError,
  } = useFollowers(undefined, { enabled: activeTab === "followers" });

  const {
    data: followingData,
    isLoading: isFollowingLoading,
    isError: isFollowingError,
  } = useFollowing(undefined, { enabled: activeTab === "following" });

  const isLoading = activeTab === "followers" ? isFollowersLoading : isFollowingLoading;
  const isError = activeTab === "followers" ? isFollowersError : isFollowingError;
  const currentList = activeTab === "followers" ? (followersData ?? []) : (followingData ?? []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleUserPress = useCallback(
    (userId: string) => {
      router.push(`/profile/${userId}`);
    },
    [router],
  );

  const handleTabPress = useCallback((newTab: TabType) => {
    setActiveTab(newTab);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FollowUser }) => (
      <UserListItem
        item={item}
        onPress={handleUserPress}
        userProfileLabel={t("profile.followers.userProfileLabel", { name: item.name })}
      />
    ),
    [handleUserPress, t],
  );

  const keyExtractor = useCallback((item: FollowUser) => item.id, []);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return null;
    }
    const message =
      activeTab === "followers"
        ? t("profile.followers.noFollowers")
        : t("profile.followers.noFollowing");
    return (
      <View testID="followers-empty" className="items-center py-12 px-4">
        <Text className="text-text-muted text-sm text-center">{message}</Text>
      </View>
    );
  }, [activeTab, isLoading, t]);

  return (
    <View testID="followers-screen" className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-surface border-b border-border">
        <Pressable
          testID="followers-back-button"
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={colors.text} />
        </Pressable>
        <Text className="text-lg font-bold text-text">
          {activeTab === "followers"
            ? t("profile.followers.followersTab")
            : t("profile.followers.followingTab")}
        </Text>
        <View style={{ width: BACK_ICON_SIZE }} />
      </View>

      <View testID="followers-tabs" className="flex-row bg-surface border-b border-border">
        <Pressable
          testID="tab-followers"
          onPress={() => handleTabPress("followers")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "followers" }}
          className="flex-1 items-center py-3"
          style={
            activeTab === "followers"
              ? { borderBottomWidth: 2, borderBottomColor: colors.primary }
              : undefined
          }
        >
          <Text
            className={
              activeTab === "followers"
                ? "text-sm font-semibold text-primary"
                : "text-sm text-text-muted"
            }
          >
            {t("profile.followers.followersTab")}
          </Text>
        </Pressable>
        <Pressable
          testID="tab-following"
          onPress={() => handleTabPress("following")}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "following" }}
          className="flex-1 items-center py-3"
          style={
            activeTab === "following"
              ? { borderBottomWidth: 2, borderBottomColor: colors.primary }
              : undefined
          }
        >
          <Text
            className={
              activeTab === "following"
                ? "text-sm font-semibold text-primary"
                : "text-sm text-text-muted"
            }
          >
            {t("profile.followers.followingTab")}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View testID="followers-loading" className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-text-muted mt-3">{t("profile.followers.loading")}</Text>
        </View>
      ) : isError ? (
        <View testID="followers-error" className="flex-1 items-center justify-center px-4">
          <Text className="text-text-muted text-base text-center">
            {t("profile.followers.fetchError")}
          </Text>
        </View>
      ) : (
        <FlatList
          testID="followers-list"
          data={currentList}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{ flexGrow: 1 }}
        />
      )}
    </View>
  );
}
