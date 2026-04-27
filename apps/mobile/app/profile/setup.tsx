import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { useColors } from "@/hooks/use-colors";
import { useUpdateMyProfile } from "@/hooks/use-my-profile";
import { useAuthStore } from "@/stores/auth-store";

/** 名前の最大文字数 */
const NAME_MAX_LENGTH = 50;

/**
 * 登録後のプロフィール設定画面
 * 名前を設定してメインアプリへ進む。スキップも可能。
 */
export default function ProfileSetupScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const clearNeedsProfileSetup = useAuthStore((s) => s.clearNeedsProfileSetup);
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const { mutateAsync: updateProfile } = useUpdateMyProfile();

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /**
   * プロフィールを保存してメイン画面へ進む
   */
  async function handleSave() {
    setErrorMessage("");
    const trimmedName = name.trim();

    if (!trimmedName) {
      setErrorMessage(t("profileSetup.validation.nameRequired"));
      return;
    }
    if (trimmedName.length > NAME_MAX_LENGTH) {
      setErrorMessage(t("profileSetup.validation.nameTooLong", { max: NAME_MAX_LENGTH }));
      return;
    }

    setIsSubmitting(true);

    try {
      await updateProfile({ name: trimmedName });
      updateUserProfile({ name: trimmedName });
    } catch {
      setErrorMessage(t("profileSetup.saveFailed"));
      setIsSubmitting(false);
      return;
    }

    clearNeedsProfileSetup();
    router.replace("/(tabs)");
  }

  /**
   * プロフィール設定をスキップしてメイン画面へ進む
   */
  function handleSkip() {
    clearNeedsProfileSetup();
    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerClassName="grow justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8">
          <Text className="text-2xl font-bold text-text">{t("profileSetup.title")}</Text>
          <Text className="mt-2 text-sm text-text-muted">{t("profileSetup.subtitle")}</Text>
        </View>

        {errorMessage !== "" && <AuthAlert message={errorMessage} />}

        <View className="gap-4">
          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">
              {t("profileSetup.nameLabel")}
            </Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder={t("profileSetup.namePlaceholder")}
              placeholderTextColor={colors.textDim}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              autoFocus
              editable={!isSubmitting}
              accessibilityLabel={t("profileSetup.nameLabel")}
              testID="profile-setup-name-input"
            />
          </View>
        </View>

        <AuthSubmitButton
          className="mt-6"
          onPress={handleSave}
          disabled={isSubmitting}
          isLoading={isSubmitting}
          testID="profile-setup-save-button"
          label={t("profileSetup.saveButton")}
          textClassName="text-base font-semibold text-white"
        />

        <Pressable
          className="mt-4 items-center py-3"
          onPress={handleSkip}
          disabled={isSubmitting}
          testID="profile-setup-skip-button"
          accessibilityRole="button"
          accessibilityLabel={t("profileSetup.skipButton")}
        >
          <Text className="text-sm text-text-muted">{t("profileSetup.skipButton")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
