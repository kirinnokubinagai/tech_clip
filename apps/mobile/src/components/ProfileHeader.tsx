import { Image } from "expo-image";
import { Settings } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { DARK_COLORS } from "@/lib/constants";

/** プロフィールヘッダーに渡すユーザーデータ */
export type ProfileHeaderUser = {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
};

type ProfileHeaderProps = {
  user: ProfileHeaderUser;
  onSettingsPress?: () => void;
};

/** アバター画像のサイズ（px） */
const AVATAR_SIZE = 80;

/** 設定アイコンのサイズ（px） */
const SETTINGS_ICON_SIZE = 22;

/** 設定アイコンのカラー */
const SETTINGS_ICON_COLOR = DARK_COLORS.textMuted;

/** アバターのフォールバック背景色 */
const AVATAR_FALLBACK_BG = DARK_COLORS.border;

/** アバターのフォールバックテキスト色 */
const AVATAR_FALLBACK_TEXT_COLOR = DARK_COLORS.text;

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
 * 数値を短縮表記にフォーマットする
 *
 * @param count - フォーマットする数値
 * @returns フォーマットされた文字列
 */
function formatCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

/**
 * プロフィールヘッダーコンポーネント
 *
 * アバター、名前、bio、フォロワー/フォロー数を表示する。
 * NativeWindダークテーマ対応。
 *
 * @param user - 表示するユーザーデータ
 * @param onSettingsPress - 設定アイコンタップ時のコールバック
 */
export function ProfileHeader({ user, onSettingsPress }: ProfileHeaderProps) {
  return (
    <View testID="profile-header" className="px-4 pt-4 pb-6 bg-surface border-b border-border">
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-row items-center gap-4">
          {user.avatarUrl ? (
            <Image
              testID="profile-avatar-image"
              source={{ uri: user.avatarUrl }}
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
              contentFit="cover"
            />
          ) : (
            <View
              testID="profile-avatar-fallback"
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: AVATAR_SIZE / 2,
                backgroundColor: AVATAR_FALLBACK_BG,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: AVATAR_FALLBACK_TEXT_COLOR, fontSize: 24, fontWeight: "bold" }}>
                {getInitials(user.name)}
              </Text>
            </View>
          )}

          <View className="flex-1">
            <Text testID="profile-name" className="text-xl font-bold text-text">
              {user.name}
            </Text>
            {user.bio && (
              <Text testID="profile-bio" className="text-sm text-text-muted mt-1" numberOfLines={3}>
                {user.bio}
              </Text>
            )}
          </View>
        </View>

        {onSettingsPress && (
          <Pressable
            testID="profile-settings-button"
            onPress={onSettingsPress}
            accessibilityRole="button"
            accessibilityLabel="設定"
            hitSlop={8}
            className="p-1"
          >
            <Settings size={SETTINGS_ICON_SIZE} color={SETTINGS_ICON_COLOR} />
          </Pressable>
        )}
      </View>

      <View testID="profile-stats" className="flex-row gap-6 mt-2">
        <View className="items-center">
          <Text testID="profile-followers-count" className="text-lg font-bold text-text">
            {formatCount(user.followersCount)}
          </Text>
          <Text className="text-xs text-text-muted">フォロワー</Text>
        </View>
        <View className="items-center">
          <Text testID="profile-following-count" className="text-lg font-bold text-text">
            {formatCount(user.followingCount)}
          </Text>
          <Text className="text-xs text-text-muted">フォロー中</Text>
        </View>
      </View>
    </View>
  );
}
