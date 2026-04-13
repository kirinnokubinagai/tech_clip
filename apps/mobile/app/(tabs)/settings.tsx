import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Globe,
  KeyRound,
  Languages,
  LogOut,
  Trash2,
  User,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { confirm } from "@/components/ConfirmDialog";
import { useColors } from "@/hooks/use-colors";

import { useSubscription } from "../../src/hooks/use-subscription";
import { useAuthStore } from "../../src/stores/auth-store";
import {
  LANGUAGE_LABEL_MAP,
  SUMMARY_LANGUAGE_LABELS,
  useSettingsStore,
} from "../../src/stores/settings-store";

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
  testID?: string;
};

/** アイコンサイズ */
const ICON_SIZE = 20;

/**
 * 設定画面の行アイテムコンポーネント
 *
 * @param icon - 左側に表示するアイコン
 * @param label - 設定項目のラベル
 * @param value - 現在の値テキスト（右側に表示）
 * @param onPress - タップ時のコールバック
 * @param trailing - 右側に表示するカスタムウィジェット（Switchなど）
 */
function SettingsRow({ icon, label, value, onPress, trailing, testID }: SettingsRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const content = (
    <View className="flex-row items-center px-4 py-3">
      <View className="mr-3">{icon}</View>
      <Text className="flex-1 text-base text-text">{label}</Text>
      {value ? <Text className="text-sm text-text-muted mr-2">{value}</Text> : null}
      {trailing ? trailing : <ChevronRight size={16} color={colors.textMuted} />}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          value ? t("common.accessibility.currentValue", { label, value }) : label
        }
        accessibilityHint={t("common.accessibility.tapToChange")}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

/**
 * 設定画面
 *
 * アカウント（ログアウト）、サブスクリプション状態、言語設定、要約言語設定、通知ON/OFFを提供する
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useColors();
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const user = useAuthStore((s) => s.user);
  const { isSubscribed } = useSubscription();

  const languageLabel = useSettingsStore((s) => LANGUAGE_LABEL_MAP[s.language]);
  const summaryLanguageLabel = useSettingsStore((s) => SUMMARY_LANGUAGE_LABELS[s.summaryLanguage]);
  const loadLanguage = useSettingsStore((s) => s.loadLanguage);
  const setSummaryLanguage = useSettingsStore((s) => s.setSummaryLanguage);
  const loadSummaryLanguage = useSettingsStore((s) => s.loadSummaryLanguage);
  const notificationSettings = useSettingsStore((s) => s.notificationSettings);
  const fetchNotificationSettings = useSettingsStore((s) => s.fetchNotificationSettings);
  const updateNotificationEnabled = useSettingsStore((s) => s.updateNotificationEnabled);

  /** 通知が有効かどうか（全通知がONの場合にtrue） */
  const isNotificationsEnabled =
    notificationSettings !== null
      ? notificationSettings.newArticle &&
        notificationSettings.aiComplete &&
        notificationSettings.follow &&
        notificationSettings.system
      : true;

  useEffect(() => {
    loadLanguage();
    loadSummaryLanguage();
    fetchNotificationSettings();
  }, [loadLanguage, loadSummaryLanguage, fetchNotificationSettings]);

  /**
   * ログアウト確認ダイアログを表示し、確認後にサインアウトを実行する
   */
  function handleLogout() {
    confirm({
      title: t("settings.logout.title"),
      message: t("settings.logout.message"),
      variant: "danger",
      confirmLabel: t("settings.logout.confirm"),
      cancelLabel: t("common.cancel"),
      onConfirm: () => {
        signOut();
      },
    });
  }

  /**
   * アカウント削除の確認ダイアログを表示し、確認後にアカウントを削除する
   */
  function handleDeleteAccount() {
    confirm({
      title: t("settings.deleteAccount.title"),
      message: t("settings.deleteAccount.message"),
      variant: "danger",
      confirmLabel: t("settings.deleteAccount.confirm"),
      cancelLabel: t("common.cancel"),
      onConfirm: () => {
        deleteAccount().catch(() => {
          Alert.alert(t("common.errorTitle"), t("settings.deleteAccount.failed"));
        });
      },
    });
  }

  /**
   * 言語選択画面に遷移する
   */
  function handleLanguageSelect() {
    router.push("/settings/language");
  }

  /**
   * 要約言語選択のアクションシートを表示する
   */
  function handleSummaryLanguageSelect() {
    const languageButtons = (
      Object.entries(SUMMARY_LANGUAGE_LABELS) as [keyof typeof SUMMARY_LANGUAGE_LABELS, string][]
    ).map(([code, label]) => ({
      text: label,
      onPress: () => {
        setSummaryLanguage(code).catch(() => {
          Alert.alert(t("common.errorTitle"), t("settings.summaryLanguageUpdateError"));
        });
      },
    }));
    Alert.alert(
      t("settings.summaryLanguageSelect.title"),
      t("settings.summaryLanguageSelect.prompt"),
      [...languageButtons, { text: t("common.cancel"), style: "cancel" as const }],
    );
  }

  /**
   * 通知トグルの変更を処理する
   *
   * @param enabled - trueで全通知ON、falseで全通知OFF
   */
  function handleNotificationToggle(enabled: boolean) {
    updateNotificationEnabled(enabled).catch(() => {
      Alert.alert(t("common.errorTitle"), t("settings.notificationUpdateError"));
    });
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <SectionTitle title={t("settings.sections.account")} />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          icon={<User size={ICON_SIZE} color={colors.textMuted} />}
          label={user?.name ?? t("settings.items.notLoggedIn")}
          value={user?.email ?? ""}
        />
        <SectionDivider />
        <SettingsRow
          icon={<KeyRound size={ICON_SIZE} color={colors.textMuted} />}
          label={t("settings.items.changePassword")}
          onPress={() => router.push("/settings/change-password")}
        />
        <SectionDivider />
        <SettingsRow
          testID="settings-logout-button"
          icon={<LogOut size={ICON_SIZE} color={colors.error} />}
          label={t("settings.items.logout")}
          onPress={handleLogout}
          trailing={<View />}
        />
      </View>

      <SectionTitle title={t("settings.sections.subscription")} />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          icon={<CreditCard size={ICON_SIZE} color={colors.textMuted} />}
          label={t("settings.items.plan")}
          value={isSubscribed ? t("settings.plan.premium") : t("settings.plan.free")}
        />
      </View>

      <SectionTitle title={t("settings.sections.general")} />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          testID="settings-language-button"
          icon={<Globe size={ICON_SIZE} color={colors.textMuted} />}
          label={t("settings.items.language")}
          value={languageLabel}
          onPress={handleLanguageSelect}
        />
        <SectionDivider />
        <SettingsRow
          testID="settings-summary-language-button"
          icon={<Languages size={ICON_SIZE} color={colors.textMuted} />}
          label={t("settings.items.summaryLanguage")}
          value={summaryLanguageLabel}
          onPress={handleSummaryLanguageSelect}
        />
        <SectionDivider />
        <SettingsRow
          icon={<Bell size={ICON_SIZE} color={colors.textMuted} />}
          label={t("settings.items.notifications")}
          trailing={
            <Switch
              testID="settings-notification-switch"
              value={isNotificationsEnabled}
              onValueChange={handleNotificationToggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
              accessibilityLabel={t("settings.items.notifications")}
              accessibilityHint={
                isNotificationsEnabled
                  ? t("settings.notificationHintOff")
                  : t("settings.notificationHintOn")
              }
              accessibilityRole="switch"
            />
          }
        />
      </View>

      <SectionTitle title={t("settings.sections.accountManagement")} />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          testID="settings-delete-account-button"
          icon={<Trash2 size={ICON_SIZE} color={colors.error} />}
          label={t("settings.items.deleteAccount")}
          onPress={handleDeleteAccount}
          trailing={<View />}
        />
      </View>

      <View className="px-4 py-6">
        <Text className="text-center text-xs text-text-dim">
          {t("settings.version")} {Constants.expoConfig?.version ?? ""}
        </Text>
      </View>
    </ScrollView>
  );
}
