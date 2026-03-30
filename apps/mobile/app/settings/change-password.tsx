import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";

/** 戻るアイコンのサイズ（px） */
const BACK_ICON_SIZE = 24;

/** テキストカラー */
const TEXT_COLOR = "#e2e8f0";

/** パスワード最小文字数 */
const PASSWORD_MIN_LENGTH = 8;

/** パスワード最大文字数 */
const PASSWORD_MAX_LENGTH = 128;

/** パスワード変更フォームのデータ */
type ChangePasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/** バリデーションエラーの型 */
type FormErrors = Partial<Record<keyof ChangePasswordFormData, string>>;

/** t関数の型 */
type TFunction = (key: string, opts?: Record<string, unknown>) => string;

/**
 * パスワード変更フォームのバリデーションを実行する
 *
 * @param data - バリデーション対象のフォームデータ
 * @param t - 翻訳関数
 * @returns エラーオブジェクト。エラーがない場合は空オブジェクト
 */
export function validateChangePasswordForm(data: ChangePasswordFormData, t: TFunction): FormErrors {
  const errors: FormErrors = {};

  if (!data.currentPassword) {
    errors.currentPassword = t("settings.changePassword.validation.currentPasswordRequired");
  }

  if (!data.newPassword) {
    errors.newPassword = t("settings.changePassword.validation.newPasswordRequired");
  } else if (data.newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.newPassword = t("settings.changePassword.validation.newPasswordTooShort", {
      min: PASSWORD_MIN_LENGTH,
    });
  } else if (data.newPassword.length > PASSWORD_MAX_LENGTH) {
    errors.newPassword = t("settings.changePassword.validation.newPasswordTooLong", {
      max: PASSWORD_MAX_LENGTH,
    });
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = t("settings.changePassword.validation.confirmPasswordRequired");
  } else if (data.newPassword && data.newPassword !== data.confirmPassword) {
    errors.confirmPassword = t("settings.changePassword.validation.passwordMismatch");
  }

  return errors;
}

/**
 * パスワード変更画面
 *
 * 現在のパスワード、新しいパスワード、確認用パスワードの入力フォームを提供する
 */
export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const changePassword = useAuthStore((s) => s.changePassword);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const [formData, setFormData] = useState<ChangePasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  /**
   * フォームフィールドの値を更新する
   *
   * @param field - 更新対象のフィールド名
   * @param value - 新しい値
   */
  const updateField = useCallback((field: keyof ChangePasswordFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /**
   * パスワード変更を実行する
   */
  const handleSave = useCallback(async () => {
    const validationErrors = validateChangePasswordForm(formData, t);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);

    try {
      await changePassword(formData.currentPassword, formData.newPassword);
      showToast(t("settings.changePassword.saveSuccess"), "success");
      router.back();
    } catch {
      Alert.alert(t("common.errorTitle"), t("settings.changePassword.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [formData, changePassword, router, showToast, t]);

  return (
    <View testID="change-password-screen" className="flex-1 bg-background">
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={dismissToast}
      />
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-surface border-b border-border">
        <Pressable
          testID="change-password-back-button"
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={TEXT_COLOR} />
        </Pressable>
        <Text className="text-lg font-bold text-text">{t("settings.changePassword.title")}</Text>
        <View style={{ width: BACK_ICON_SIZE }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-4 pt-6 gap-4">
          <Input
            label={t("settings.changePassword.currentPassword")}
            placeholder={t("settings.changePassword.currentPasswordPlaceholder")}
            value={formData.currentPassword}
            onChangeText={(text) => updateField("currentPassword", text)}
            error={errors.currentPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <Input
            label={t("settings.changePassword.newPassword")}
            placeholder={t("settings.changePassword.newPasswordPlaceholder")}
            value={formData.newPassword}
            onChangeText={(text) => updateField("newPassword", text)}
            error={errors.newPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <Input
            label={t("settings.changePassword.confirmPassword")}
            placeholder={t("settings.changePassword.confirmPasswordPlaceholder")}
            value={formData.confirmPassword}
            onChangeText={(text) => updateField("confirmPassword", text)}
            error={errors.confirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <View className="pt-4">
            <Button onPress={handleSave} loading={isSaving} disabled={isSaving}>
              {t("settings.changePassword.saveButton")}
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
