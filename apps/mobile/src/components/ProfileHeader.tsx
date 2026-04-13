import { Image } from "expo-image";
import { Settings } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { getInitials } from "@/utils/formatters";

/** プロフィールヘッダーに渡すユーザーデータ */
export type ProfileHeaderUser = {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  /** undefined のとき "-" を表示（APIから取得できない場合） */
  followersCount: number | undefined;
  /** undefined のとき "-" を表示（APIから取得できない場合） */
  followingCount: number | undefined;
};

type ProfileHeaderProps = {
  user: ProfileHeaderUser;
  onSettingsPress?: () => void;
};

/** アバター画像のサイズ（px） */
const AVATAR_SIZE = 80;

/** 設定アイコンのサイズ（px） */
const SETTINGS_ICON_SIZE = 22;

/**
 * 数値を短縮表記にフォーマットする
 *
 * @param count - フォーマットする数値。undefinedの場合は"-"を返す
 * @returns フォーマットされた文字列
 */
function formatCount(count: number | undefined): string {
  if (count === undefined) {
    return "-";
  }
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
  const colors = useColors();
  const { t } = useTranslation();
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
                backgroundColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontSize: 24, fontWeight: "bold" }}>
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
            accessibilityLabel={t("common.accessibility.settings")}
            hitSlop={8}
            className="p-1"
          >
            <Settings size={SETTINGS_ICON_SIZE} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <View testID="profile-stats" className="flex-row gap-6 mt-2">
        <View className="items-center">
          <Text testID="profile-followers-count" className="text-lg font-bold text-text">
            {formatCount(user.followersCount)}
          </Text>
          <Text className="text-xs text-text-muted">{t("profile.followersLabel")}</Text>
        </View>
        <View className="items-center">
          <Text testID="profile-following-count" className="text-lg font-bold text-text">
            {formatCount(user.followingCount)}
          </Text>
          <Text className="text-xs text-text-muted">{t("profile.followingLabel")}</Text>
        </View>
      </View>
    </View>
  );
}
