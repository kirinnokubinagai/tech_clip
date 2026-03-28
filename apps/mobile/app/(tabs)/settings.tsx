import { Bell, ChevronRight, CreditCard, Globe, LogOut, User } from "lucide-react-native";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

import { confirm } from "@/components/ConfirmDialog";
import { useAuthStore } from "../../src/stores/auth-store";

/** 設定セクションの区切り線コンポーネント */
function SectionDivider() {
  return <View className="h-px bg-border my-2" />;
}

/** セクションタイトル */
function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-text-dim uppercase tracking-wider px-4 pt-4 pb-2">
      {title}
    </Text>
  );
}

/** 設定行アイテムのProps型 */
type SettingsRowProps = {
  icon: ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  trailing?: ReactNode;
};

/** アイコンサイズ */
const ICON_SIZE = 20;

/** アイコンカラー */
const ICON_COLOR = "#94a3b8";

/**
 * 設定画面の行アイテムコンポーネント
 *
 * @param icon - 左側に表示するアイコン
 * @param label - 設定項目のラベル
 * @param value - 現在の値テキスト（右側に表示）
 * @param onPress - タップ時のコールバック
 * @param trailing - 右側に表示するカスタムウィジェット（Switchなど）
 */
function SettingsRow({ icon, label, value, onPress, trailing }: SettingsRowProps) {
  const content = (
    <View className="flex-row items-center px-4 py-3">
      <View className="mr-3">{icon}</View>
      <Text className="flex-1 text-base text-text">{label}</Text>
      {value ? <Text className="text-sm text-text-muted mr-2">{value}</Text> : null}
      {trailing ? trailing : <ChevronRight size={16} color={ICON_COLOR} />}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return content;
}

/** 言語選択肢 */
const LANGUAGE_OPTIONS = ["日本語", "English"] as const;

/** 言語選択肢の型 */
type Language = (typeof LANGUAGE_OPTIONS)[number];

/**
 * 設定画面
 *
 * アカウント（ログアウト）、サブスクリプション状態、言語設定、通知ON/OFFを提供する
 */
export default function SettingsScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);

  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("日本語");

  /**
   * ログアウト確認ダイアログを表示し、確認後にサインアウトを実行する
   */
  function handleLogout() {
    confirm({
      title: "ログアウト",
      message: "ログアウトしますか？",
      variant: "danger",
      confirmLabel: "ログアウト",
      cancelLabel: "キャンセル",
      onConfirm: () => {
        signOut();
      },
    });
  }

  /**
   * 言語選択のアクションシートを表示する
   */
  function handleLanguageSelect() {
    Alert.alert("言語設定", "表示言語を選択してください", [
      {
        text: "日本語",
        onPress: () => setSelectedLanguage("日本語"),
      },
      {
        text: "English",
        onPress: () => setSelectedLanguage("English"),
      },
      { text: "キャンセル", style: "cancel" },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <SectionTitle title="アカウント" />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          icon={<User size={ICON_SIZE} color={ICON_COLOR} />}
          label={user?.name ?? "未ログイン"}
          value={user?.email ?? ""}
        />
        <SectionDivider />
        <SettingsRow
          icon={<LogOut size={ICON_SIZE} color="#ef4444" />}
          label="ログアウト"
          onPress={handleLogout}
          trailing={<View />}
        />
      </View>

      <SectionTitle title="サブスクリプション" />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          icon={<CreditCard size={ICON_SIZE} color={ICON_COLOR} />}
          label="プラン"
          value="Free"
        />
      </View>

      <SectionTitle title="一般" />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          icon={<Globe size={ICON_SIZE} color={ICON_COLOR} />}
          label="言語"
          value={selectedLanguage}
          onPress={handleLanguageSelect}
        />
        <SectionDivider />
        <SettingsRow
          icon={<Bell size={ICON_SIZE} color={ICON_COLOR} />}
          label="通知"
          trailing={
            <Switch
              value={isNotificationsEnabled}
              onValueChange={setIsNotificationsEnabled}
              trackColor={{ false: "#2d2d44", true: "#6366f1" }}
              thumbColor="#ffffff"
            />
          }
        />
      </View>

      <View className="px-4 py-6">
        <Text className="text-center text-xs text-text-dim">TechClip v0.0.1</Text>
      </View>
    </ScrollView>
  );
}
