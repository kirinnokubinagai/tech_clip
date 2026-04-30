import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { ErrorView } from "@/components/ErrorView";
import { useColors } from "@/hooks/use-colors";
import type { FollowUserItem } from "@/hooks/use-follows";
import { useFollowers, useFollowing } from "@/hooks/use-follows";
import { useAuthStore } from "@/stores/auth-store";

/** タブの種類 */
type TabType = "followers" | "following";

/** 戻るアイコンのサイズ（px） */
const BACK_ICON_SIZE = 24;

/** アバターのサイズ（px） */
const AVATAR_SIZE = 48;

/** 無限スクロールの発火閾値（リスト全体に対する割合） */
const END_REACHED_THRESHOLD = 0.5;

/** アバターイニシャルのフォントサイズ */
const AVATAR_INITIAL_FONT_SIZE = 16;

/**
 * 文字列の最初の文字（サロゲートペア対応）を取得する
 *
 * @param s - 対象文字列
 * @returns 最初の文字
 */
function firstChar(s: string): string {
  return Array.from(s)[0] ?? "";
}

/**
 * 表示名を解決する
 *
 * @param name - ユーザー名（null 許容）
 * @param fallback - 代替文字列
 * @returns 有効な名前があればその値、なければ fallback
 */
function resolveDisplayName(name: string | null, fallback: string): string {
  if (name && name.trim() !== "") return name;
  return fallback;
}

/**
 * ユーザー名の頭文字を取得する
 *
 * @param name - ユーザー名
 * @returns 頭文字（最大2文字）
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${firstChar(parts[0])}${firstChar(parts[1])}`.toUpperCase();
  }
  return Array.from(name).slice(0, 2).join("").toUpperCase();
}

type UserListItemProps = {
  item: FollowUserItem;
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
  const { t } = useTranslation();
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  const displayName = resolveDisplayName(item.name, t("profile.followers.unknownUser"));

  return (
    <Pressable
      testID="follower-list-item"
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
              fontSize: AVATAR_INITIAL_FONT_SIZE,
              fontWeight: "bold",
            }}
          >
            {getInitials(displayName)}
          </Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-base font-semibold text-text">{displayName}</Text>
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
 * クエリパラメータ `userId` で対象ユーザーIDを指定可能（未指定時は認証済みユーザー自身）。
 */
export default function FollowersScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { tab, userId: paramUserId } = useLocalSearchParams<{ tab?: string; userId?: string }>();
  const router = useRouter();
  const authUser = useAuthStore((state) => state.user);

  const targetUserId = paramUserId ?? authUser?.id ?? "";

  /**
   * URLクエリパラメータ `tab` による初期タブ設定。
   * マウント時の初期値のみ反映される。マウント後のクエリパラメータ変更は無視される。
   */
  const initialTab: TabType = tab === "following" ? "following" : "followers";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const followersQuery = useFollowers(targetUserId, {
    enabled: !!targetUserId && activeTab === "followers",
  });
  const followingQuery = useFollowing(targetUserId, {
    enabled: !!targetUserId && activeTab === "following",
  });

  const activeQuery = activeTab === "followers" ? followersQuery : followingQuery;

  const currentList = useMemo(
    () => activeQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [activeQuery.data],
  );

  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleUserPress = useCallback(
    (userId: string) => {
      router.push(`/profile/${userId}`);
    },
    [router],
  );

  const handleTabPress = useCallback((nextTab: TabType) => setActiveTab(nextTab), []);

  const renderItem = useCallback(
    ({ item }: { item: FollowUserItem }) => {
      const accessibilityName = resolveDisplayName(item.name, t("profile.followers.unknownUser"));
      return (
        <UserListItem
          item={item}
          onPress={handleUserPress}
          userProfileLabel={t("profile.followers.userProfileLabel", { name: accessibilityName })}
        />
      );
    },
    [handleUserPress, t],
  );

  const keyExtractor = useCallback((item: FollowUserItem) => item.id, []);

  const { hasNextPage, isFetchingNextPage, fetchNextPage, refetch: activeRefetch } = activeQuery;

  const handleRetry = useCallback(() => {
    void activeRefetch();
  }, [activeRefetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const renderContent = useCallback(() => {
    if (isError) {
      return (
        <View testID="followers-error" className="flex-1 items-center justify-center px-4">
          <Text className="text-text-muted text-base text-center">
            {activeTab === "followers"
              ? t("profile.followers.errorFollowers")
              : t("profile.followers.errorFollowing")}
          </Text>
          <Pressable
            onPress={handleRetry}
            className="mt-4 bg-primary rounded-lg px-6 py-3"
            accessibilityRole="button"
            accessibilityLabel={t("profile.followers.retry")}
          >
            <Text className="text-white font-semibold">{t("profile.followers.retry")}</Text>
          </Pressable>
        </View>
      );
    }
    if (isLoading) {
      return (
        <View testID="followers-loading" className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-text-muted mt-3">{t("profile.followers.loading")}</Text>
        </View>
      );
    }
    return (
      <FlatList
        testID="followers-list"
        data={currentList}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={{ flexGrow: 1 }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={END_REACHED_THRESHOLD}
      />
    );
  }, [
    isError,
    isLoading,
    activeTab,
    t,
    handleRetry,
    colors.primary,
    currentList,
    renderItem,
    keyExtractor,
    renderEmpty,
    isFetchingNextPage,
    handleEndReached,
  ]);

  if (!targetUserId) {
    return <ErrorView message={t("profile.followers.userNotSpecified")} />;
  }

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
        {/** ヘッダー左の戻るボタンとの対称レイアウト用スペーサー */}
        <View style={{ width: BACK_ICON_SIZE }} accessible={false} />
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

      {renderContent()}
    </View>
  );
}
