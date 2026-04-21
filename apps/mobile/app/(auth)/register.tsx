import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
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
import { OAuthButtons, type SocialProvider } from "@/components/auth/OAuthButtons";
import { useColors } from "@/hooks/use-colors";
import { EMAIL_SIMPLE_REGEX, PASSWORD_MIN_LENGTH } from "@/lib/validation";
import { useAuthStore } from "@/stores/auth-store";

/**
 * 新規登録画面
 * メール・パスワード入力による登録フォームと、
 * Google / GitHub OAuth による登録ボタンを表示する。
 * OAuth 経由の場合、Better Auth が初回認証時に自動でアカウント作成を行う。
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const signUp = useAuthStore((s) => s.signUp);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<SocialProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const isAnySubmitting = isSubmitting || socialLoadingProvider !== null;

  /**
   * 新規登録フォームを送信する
   */
  async function handleRegister() {
    setErrorMessage("");
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage(t("auth.validation.emailRequired"));
      return;
    }
    if (!EMAIL_SIMPLE_REGEX.test(trimmedEmail)) {
      setErrorMessage(t("auth.validation.emailInvalid"));
      return;
    }
    if (!password) {
      setErrorMessage(t("auth.validation.passwordRequired"));
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setErrorMessage(t("auth.validation.passwordMinLength", { min: PASSWORD_MIN_LENGTH }));
      return;
    }

    setIsSubmitting(true);

    try {
      await signUp({ name: name.trim() || undefined, email: email.trim(), password });
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
        contentContainerClassName="flex-1 justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-10 items-center">
          <Image
            source={require("../../assets/images/icon.png")}
            style={{ width: 80, height: 80, marginBottom: 16 }}
            resizeMode="contain"
            accessibilityLabel="TechClip logo"
          />
          <Text className="text-3xl font-bold text-text">TechClip</Text>
          <Text className="mt-2 text-base text-text-muted">{t("auth.createAccount")}</Text>
        </View>

        {errorMessage !== "" && <AuthAlert message={errorMessage} />}

        <View className="gap-4">
          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">
              {t("auth.nameOptional")}
            </Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder={t("auth.nameOptionalHint")}
              placeholderTextColor={colors.textDim}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              editable={!isAnySubmitting}
              accessibilityLabel={t("auth.nameOptional")}
              accessibilityHint={t("auth.nameHint")}
              testID="register-name-input"
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">{t("auth.email")}</Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={colors.textDim}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isAnySubmitting}
              accessibilityLabel={t("auth.email")}
              accessibilityHint={t("auth.emailHint")}
              testID="register-email-input"
            />
          </View>

          <View>
            <Text className="mb-1.5 text-sm font-medium text-text-muted">{t("auth.password")}</Text>
            <TextInput
              className="rounded-lg border border-border bg-surface px-4 py-3 text-base text-text"
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={colors.textDim}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!isAnySubmitting}
              accessibilityLabel={t("auth.password")}
              accessibilityHint={t("auth.passwordHint", { min: PASSWORD_MIN_LENGTH })}
              testID="register-password-input"
            />
          </View>
        </View>

        <AuthSubmitButton
          className="mt-6"
          onPress={handleRegister}
          disabled={isAnySubmitting}
          isLoading={isSubmitting}
          testID="register-submit-button"
          label={t("auth.createAccount")}
          accessibilityHint={t("auth.registerHint")}
          textClassName="text-base font-semibold text-white"
        />

        <View className="my-6 flex-row items-center">
          <View className="h-px flex-1 bg-border" />
          <Text className="mx-3 text-sm text-text-muted">{t("auth.socialSeparator")}</Text>
          <View className="h-px flex-1 bg-border" />
        </View>

        <OAuthButtons
          mode="signup"
          isAnySubmitting={isAnySubmitting}
          onError={setErrorMessage}
          onLoadingChange={setSocialLoadingProvider}
          loadingProvider={socialLoadingProvider}
        />

        <View className="mt-6 flex-row items-center justify-center">
          <Text className="text-sm text-text-muted">{t("auth.registerToLoginPrompt")}</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable testID="register-login-link">
              <Text className="ml-1 text-sm font-semibold text-primary">{t("auth.login")}</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
