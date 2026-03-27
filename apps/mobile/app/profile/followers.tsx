import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";

/** タブの種類 */
type TabType = "followers" | "following";

/** ユーザーアイテムの型 */
type UserItem = {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
};

/** 戻るアイコンのサイズ（px） */
const BACK_ICON_SIZE = 24;

/** アバターのサイズ（px） */
const AVATAR_SIZE = 48;

/** テキストカラー */
const TEXT_COLOR = "#e2e8f0";

/** プライマリカラー */
const PRIMARY_COLOR = "#6366f1";

/** アバターのフォールバック背景色 */
const AVATAR_FALLBACK_BG = "#2d2d44";

/** アバターのフォールバックテキスト色 */
const AVATAR_FALLBACK_TEXT_COLOR = "#e2e8f0";

/** アクティブタブの下線カラー */
const ACTIVE_TAB_BORDER_COLOR = "#6366f1";

/**
 * ユーザー名の頭文字を取得する
 *
 * @param name - ユーザー名
 * @returns 頭文字（最大2文字）
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * プレースホルダーのフォロワーリストを生成する
 * API実装後に置き換え予定
 *
 * @returns ダミーのユーザーリスト
 */
function createPlaceholderFollowers(): UserItem[] {
  return [
    { id: "1", name: "田中太郎", bio: "フロントエンドエンジニア", avatarUrl: null },
    { id: "2", name: "佐藤花子", bio: "バックエンドエンジニア", avatarUrl: null },
    { id: "3", name: "鈴木一郎", bio: null, avatarUrl: null },
  ];
}

/**
 * プレースホルダーのフォロー中リストを生成する
 * API実装後に置き換え予定
 *
 * @returns ダミーのユーザーリスト
 */
function createPlaceholderFollowing(): UserItem[] {
  return [
    { id: "4", name: "高橋実", bio: "モバイルエンジニア", avatarUrl: null },
    { id: "5", name: "伊藤めぐみ", bio: "デザイナー", avatarUrl: null },
  ];
}

type UserListItemProps = {
  item: UserItem;
  onPress: (userId: string) => void;
};

/**
 * ユーザーリストアイテムコンポーネント
 *
 * @param item - 表示するユーザーデータ
 * @param onPress - タップ時のコールバック
 */
function UserListItem({ item, onPress }: UserListItemProps) {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable
      testID={`user-item-${item.id}`}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}のプロフィールを表示`}
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
            backgroundColor: AVATAR_FALLBACK_BG,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: AVATAR_FALLBACK_TEXT_COLOR,
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
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();

  const initialTab: TabType = tab === "following" ? "following" : "followers";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [isLoading] = useState(false);

  const followers = createPlaceholderFollowers();
  const following = createPlaceholderFollowing();

  const currentList = activeTab === "followers" ? followers : following;

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
    ({ item }: { item: UserItem }) => (
      <UserListItem item={item} onPress={handleUserPress} />
    ),
    [handleUserPress],
  );

  const keyExtractor = useCallback((item: UserItem) => item.id, []);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return null;
    }
    const message =
      activeTab === "followers"
        ? "フォロワーはまだいません"
        : "フォロー中のユーザーはいません";
    return (
      <View testID="followers-empty" className="items-center py-12 px-4">
        <Text className="text-text-muted text-sm text-center">{message}</Text>
      </View>
    );
  }, [activeTab, isLoading]);

  return (
    <View testID="followers-screen" className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-surface border-b border-border">
        <Pressable
          testID="followers-back-button"
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="戻る"
          hitSlop={8}
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={TEXT_COLOR} />
        </Pressable>
        <Text className="text-lg font-bold text-text">
          {activeTab === "followers" ? "フォロワー" : "フォロー中"}
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
              ? { borderBottomWidth: 2, borderBottomColor: ACTIVE_TAB_BORDER_COLOR }
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
            フォロワー
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
              ? { borderBottomWidth: 2, borderBottomColor: ACTIVE_TAB_BORDER_COLOR }
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
            フォロー中
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View testID="followers-loading" className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text className="text-text-muted mt-3">読み込み中...</Text>
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
