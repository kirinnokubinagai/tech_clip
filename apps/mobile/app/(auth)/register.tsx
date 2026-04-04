import { Link } from "expo-router";
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
import { AUTH_PLACEHOLDER_TEXT_COLOR } from "@/lib/ui-colors";
import { useAuthStore } from "../../src/stores/auth-store";

export default function RegisterScreen() {
  const { t } = useTranslation();
  const signUp = useAuthStore((s) => s.signUp);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /**
   * 新規登録フォームを送信する
   */
  async function handleRegister() {
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage(t("auth.validation.nameRequired"));
      return;
    }
    if (!email.trim()) {
      setErrorMessage(t("auth.validation.emailRequired"));
      return;
    }
    if (!password.trim()) {
      setErrorMessage(t("auth.validation.passwordRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp({ name: name.trim(), email: email.trim(), password });
    } catch (error: unknown) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(t("auth.registerFailed"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-10 items-center">
          <Text className="text-3xl font-bold text-text">TechClip</Text>
          <Text className="mt-2 text-base text-text-muted">{t("auth.createAccount")}</Text>
        </View>

        {errorMessage !== "" && <AuthAlert message={errorMessage} />}

        <View className="gap-4">
          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">{t("auth.name")}</Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder={t("auth.namePlaceholder")}
              placeholderTextColor={AUTH_PLACEHOLDER_TEXT_COLOR}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              editable={!isSubmitting}
              accessibilityLabel="名前"
              accessibilityHint="お名前を入力してください"
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">{t("auth.email")}</Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder="example@domain.com"
              placeholderTextColor={AUTH_PLACEHOLDER_TEXT_COLOR}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isSubmitting}
              accessibilityLabel="メールアドレス"
              accessibilityHint="メールアドレスを入力してください"
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">{t("auth.password")}</Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={AUTH_PLACEHOLDER_TEXT_COLOR}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!isSubmitting}
              accessibilityLabel="パスワード"
              accessibilityHint="8文字以上のパスワードを入力してください"
            />
          </View>
        </View>

        <AuthSubmitButton
          className="mt-6 items-center rounded-lg bg-primary py-3.5"
          onPress={handleRegister}
          disabled={isSubmitting}
          label="アカウントを作成"
          accessibilityHint="入力した情報で新規アカウントを作成します"
          textClassName="text-base font-semibold text-white"
        />

        <View className="mt-6 flex-row items-center justify-center">
          <Text className="text-sm text-text-muted">{t("auth.registerToLoginPrompt")}</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text className="ml-1 text-sm font-semibold text-primary">{t("auth.login")}</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
