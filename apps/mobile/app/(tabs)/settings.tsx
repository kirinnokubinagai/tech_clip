import { useRouter } from "expo-router";
import {
  Bell,
  BellOff,
  ChevronRight,
  CreditCard,
  Globe,
  KeyRound,
  LogOut,
  Trash2,
  User,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { confirm } from "@/components/ConfirmDialog";
import { useSubscription } from "@/hooks/use-subscription";
import { DARK_COLORS } from "@/lib/constants";
import {
  checkNotificationPermission,
  registerPushTokenOnly,
  requestNotificationPermission,
} from "@/lib/notifications";
import { useAuthStore } from "@/stores/auth-store";
import { LANGUAGE_LABEL_MAP, useSettingsStore } from "@/stores/settings-store";

/**
 * 通知権限とトグル状態からアクセシビリティヒントを決定する
 *
 * @param permission - 通知権限ステータス
 * @param enabled - 通知が有効かどうか
 * @param t - i18n翻訳関数
 * @returns アクセシビリティヒント文字列
 */
function getNotificationHint(
  permission: string,
  enabled: boolean,
  t: (key: string) => string,
): string {
  if (permission === "denied") return t("settings.items.notificationPermissionDenied");
  if (permission !== "granted") return t("settings.notificationHintUndetermined");
  if (enabled) return t("settings.notificationHintOff");
  return t("settings.notificationHintOn");
}

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

/** アイコンカラー */
const ICON_COLOR = DARK_COLORS.textMuted;

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
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}、現在の設定: ${value}` : label}
        accessibilityHint={`${label}の設定を変更します`}
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
 * アカウント（ログアウト）、サブスクリプション状態、言語設定、通知ON/OFFを提供する
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const user = useAuthStore((s) => s.user);
  const { isSubscribed } = useSubscription();

  const languageLabel = useSettingsStore((s) => LANGUAGE_LABEL_MAP[s.language]);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const loadLanguage = useSettingsStore((s) => s.loadLanguage);
  const notificationSettings = useSettingsStore((s) => s.notificationSettings);
  const fetchNotificationSettings = useSettingsStore((s) => s.fetchNotificationSettings);
  const updateNotificationEnabled = useSettingsStore((s) => s.updateNotificationEnabled);

  /** 通知権限ステータス */
  const [notificationPermission, setNotificationPermission] = useState<
    "granted" | "denied" | "undetermined" | "loading"
  >("loading");

  /** 通知が有効かどうか（全通知がONの場合にtrue） */
  const isNotificationsEnabled =
    notificationSettings !== null
      ? notificationSettings.newArticle &&
        notificationSettings.aiComplete &&
        notificationSettings.follow &&
        notificationSettings.system
      : true;

  /** 通知スイッチのアクセシビリティヒント */
  const notificationAccessibilityHint = getNotificationHint(
    notificationPermission,
    isNotificationsEnabled,
    t,
  );

  useEffect(() => {
    loadLanguage();
    fetchNotificationSettings();
  }, [loadLanguage, fetchNotificationSettings]);

  const refreshPermission = useCallback(() => {
    checkNotificationPermission()
      .then((status) => {
        setNotificationPermission(status);
      })
      .catch(() => {
        setNotificationPermission("undetermined");
      });
  }, []);

  useEffect(() => {
    refreshPermission();
  }, [refreshPermission]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState !== "active") return;
      refreshPermission();
    });
    return () => {
      subscription.remove();
    };
  }, [refreshPermission]);

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
   * 言語選択のアクションシートを表示する
   */
  function handleLanguageSelect() {
    Alert.alert(t("settings.languageSelect.title"), t("settings.languageSelect.prompt"), [
      {
        text: "日本語",
        onPress: () => {
          setLanguage("ja");
        },
      },
      {
        text: "English",
        onPress: () => {
          setLanguage("en");
        },
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
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

  /**
   * 通知権限を要求し、許可された場合はプッシュトークンを登録する
   * 権限取得後は registerPushTokenOnly を呼び出すことで二重の権限要求を避ける
   */
  async function handleRequestNotificationPermission() {
    try {
      if (notificationPermission === "denied") {
        await Linking.openSettings();
        return;
      }
      const status = await requestNotificationPermission();
      setNotificationPermission(status);
      if (status === "granted") {
        await registerPushTokenOnly();
      }
    } catch (_error) {
      Alert.alert(t("common.errorTitle"), t("settings.notificationUpdateError"));
    }
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <SectionTitle title={t("settings.sections.account")} />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          icon={<User size={ICON_SIZE} color={ICON_COLOR} />}
          label={user?.name ?? t("settings.items.notLoggedIn")}
          value={user?.email ?? ""}
        />
        <SectionDivider />
        <SectionDivider />
        <SettingsRow
          icon={<KeyRound size={ICON_SIZE} color={ICON_COLOR} />}
          label={t("settings.items.changePassword")}
          onPress={() => router.push("/settings/change-password")}
        />
        <SectionDivider />
        <SettingsRow
          testID="settings-logout-button"
          icon={<LogOut size={ICON_SIZE} color={DARK_COLORS.error} />}
          label={t("settings.items.logout")}
          onPress={handleLogout}
          trailing={<View />}
        />
      </View>

      <SectionTitle title={t("settings.sections.subscription")} />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          icon={<CreditCard size={ICON_SIZE} color={ICON_COLOR} />}
          label={t("settings.items.plan")}
          value={isSubscribed ? "Premium" : "Free"}
        />
      </View>

      <SectionTitle title={t("settings.sections.general")} />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          testID="settings-language-button"
          icon={<Globe size={ICON_SIZE} color={ICON_COLOR} />}
          label={t("settings.items.language")}
          value={languageLabel}
          onPress={handleLanguageSelect}
        />
        <SectionDivider />
        <SettingsRow
          icon={<Bell size={ICON_SIZE} color={ICON_COLOR} />}
          label={t("settings.items.notifications")}
          trailing={
            <Switch
              testID="settings-notification-switch"
              value={isNotificationsEnabled}
              onValueChange={handleNotificationToggle}
              disabled={notificationPermission !== "granted"}
              trackColor={{ false: DARK_COLORS.border, true: DARK_COLORS.primary }}
              thumbColor={DARK_COLORS.white}
              accessibilityLabel={t("settings.items.notifications")}
              accessibilityHint={notificationAccessibilityHint}
              accessibilityRole="switch"
            />
          }
        />
        {notificationPermission !== "granted" && notificationPermission !== "loading" && (
          <Text
            testID="settings-notification-permission-hint"
            className="text-xs text-text-dim mt-1 px-4"
          >
            {t("settings.items.notificationPermissionHint")}
          </Text>
        )}
        {notificationPermission === "denied" && (
          <>
            <SectionDivider />
            <SettingsRow
              testID="settings-notification-permission-denied-button"
              icon={<BellOff size={ICON_SIZE} color={DARK_COLORS.error} />}
              label={t("settings.items.notificationPermissionDenied")}
              onPress={handleRequestNotificationPermission}
            />
          </>
        )}
        {notificationPermission === "undetermined" && (
          <>
            <SectionDivider />
            <SettingsRow
              testID="settings-notification-permission-request-button"
              icon={<Bell size={ICON_SIZE} color={ICON_COLOR} />}
              label={t("settings.items.notificationPermissionRequest")}
              onPress={handleRequestNotificationPermission}
            />
          </>
        )}
      </View>

      <SectionTitle title={t("settings.sections.accountManagement")} />
      <View className="bg-surface mx-4 rounded-xl border border-border">
        <SettingsRow
          testID="settings-delete-account-button"
          icon={<Trash2 size={ICON_SIZE} color={DARK_COLORS.error} />}
          label={t("settings.items.deleteAccount")}
          onPress={handleDeleteAccount}
          trailing={<View />}
        />
      </View>

      <View className="px-4 py-6">
        <Text className="text-center text-xs text-text-dim">TechClip v0.0.1</Text>
      </View>
    </ScrollView>
  );
}
