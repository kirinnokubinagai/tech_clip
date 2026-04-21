import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ArrowLeft, Camera } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { useColors } from "@/hooks/use-colors";
import { useMyProfile, useUpdateMyProfile, useUploadMyAvatar } from "@/hooks/use-my-profile";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { isApiErrorPayload } from "@/types/api-error";
import type { UpdateProfileInput } from "@/types/me";

/** アバター画像のサイズ（px） */
const AVATAR_SIZE = 96;

/** 戻るアイコンのサイズ（px） */
const BACK_ICON_SIZE = 24;

/** カメラアイコンのサイズ（px） */
const CAMERA_ICON_SIZE = 16;

/** 名前の最大文字数 */
const NAME_MAX_LENGTH = 50;

/** ユーザー名の最大文字数 */
const USERNAME_MAX_LENGTH = 30;

/** bioの最大文字数 */
const BIO_MAX_LENGTH = 160;

/** ウェブサイト URL の最大文字数 */
const WEBSITE_URL_MAX_LENGTH = 2048;

/** X (Twitter) ユーザー名の最大文字数 */
const TWITTER_USERNAME_MAX_LENGTH = 15;

/** GitHub ユーザー名の最大文字数 */
const GITHUB_USERNAME_MAX_LENGTH = 39;

/** ユーザー名の正規表現（半角英数字とアンダースコアとハイフン） */
const USERNAME_REGEX = /^[a-zA-Z0-9_-]*$/;

/** X (Twitter) ユーザー名の正規表現 */
const TWITTER_USERNAME_REGEX = /^[A-Za-z0-9_]*$/;

/** GitHub ユーザー名の正規表現 */
const GITHUB_USERNAME_REGEX = /^[A-Za-z0-9-]*$/;

/** URL の簡易バリデーション正規表現 */
const URL_REGEX = /^https?:\/\/.+/;

/** DUPLICATE エラーコード */
const ERROR_CODE_DUPLICATE = "DUPLICATE";

/** VALIDATION_FAILED エラーコード */
const ERROR_CODE_VALIDATION_FAILED = "VALIDATION_FAILED";

/** プロフィール編集フォームのデータ */
type ProfileFormData = {
  name: string;
  username: string;
  bio: string;
  twitterUsername: string;
  githubUsername: string;
  websiteUrl: string;
};

/** バリデーションエラーの型 */
type FormErrors = Partial<Record<keyof ProfileFormData, string>>;

/** t関数の型 */
type TFunction = (key: string, opts?: Record<string, unknown>) => string;

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
 * フォームデータのバリデーションを実行する
 *
 * @param data - バリデーション対象のフォームデータ
 * @param t - 翻訳関数
 * @returns エラーオブジェクト。エラーがない場合は空オブジェクト
 */
export function validateProfileForm(data: ProfileFormData, t: TFunction): FormErrors {
  const errors: FormErrors = {};

  if (!data.name.trim()) {
    errors.name = t("profile.edit.validation.nameRequired");
  }
  if (data.name.length > NAME_MAX_LENGTH) {
    errors.name = t("profile.edit.validation.nameTooLong", { max: NAME_MAX_LENGTH });
  }

  if (data.username && !USERNAME_REGEX.test(data.username)) {
    errors.username = t("profile.edit.validation.usernameInvalid");
  }
  if (data.username.length > USERNAME_MAX_LENGTH) {
    errors.username = t("profile.edit.validation.usernameTooLong", { max: USERNAME_MAX_LENGTH });
  }

  if (data.bio.length > BIO_MAX_LENGTH) {
    errors.bio = t("profile.edit.validation.bioTooLong", { max: BIO_MAX_LENGTH });
  }

  if (data.websiteUrl && data.websiteUrl.length > WEBSITE_URL_MAX_LENGTH) {
    errors.websiteUrl = t("profile.edit.validation.websiteUrlTooLong", {
      max: WEBSITE_URL_MAX_LENGTH,
    });
  }
  if (data.websiteUrl && !URL_REGEX.test(data.websiteUrl)) {
    errors.websiteUrl = t("profile.edit.validation.websiteUrlInvalid");
  }

  if (data.twitterUsername && data.twitterUsername.length > TWITTER_USERNAME_MAX_LENGTH) {
    errors.twitterUsername = t("profile.edit.validation.twitterUsernameTooLong", {
      max: TWITTER_USERNAME_MAX_LENGTH,
    });
  }
  if (data.twitterUsername && !TWITTER_USERNAME_REGEX.test(data.twitterUsername)) {
    errors.twitterUsername = t("profile.edit.validation.twitterUsernameInvalid");
  }

  if (data.githubUsername && data.githubUsername.length > GITHUB_USERNAME_MAX_LENGTH) {
    errors.githubUsername = t("profile.edit.validation.githubUsernameTooLong", {
      max: GITHUB_USERNAME_MAX_LENGTH,
    });
  }
  if (data.githubUsername && !GITHUB_USERNAME_REGEX.test(data.githubUsername)) {
    errors.githubUsername = t("profile.edit.validation.githubUsernameInvalid");
  }

  return errors;
}

/**
 * 2つのフォームデータを比較して差分を返す
 *
 * @param current - 現在のフォームデータ
 * @param initial - 初期データ
 * @returns 変更があったフィールドのみを含む更新リクエストオブジェクト
 */
function buildPatch(current: ProfileFormData, initial: ProfileFormData): UpdateProfileInput | null {
  const patch: UpdateProfileInput = {};

  if (current.name !== initial.name) {
    patch.name = current.name;
  }
  if (current.username !== initial.username) {
    patch.username = current.username || null;
  }
  if (current.bio !== initial.bio) {
    patch.bio = current.bio || null;
  }
  if (current.websiteUrl !== initial.websiteUrl) {
    patch.websiteUrl = current.websiteUrl || null;
  }
  if (current.twitterUsername !== initial.twitterUsername) {
    patch.twitterUsername = current.twitterUsername || null;
  }
  if (current.githubUsername !== initial.githubUsername) {
    patch.githubUsername = current.githubUsername || null;
  }

  if (Object.keys(patch).length === 0) {
    return null;
  }
  return patch;
}

/**
 * プロフィール編集画面
 *
 * 名前、ユーザー名、bio、SNSリンクの編集とアバター変更を提供する。
 * NativeWindダークテーマ対応。
 */
export default function ProfileEditScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const updateUserProfile = useAuthStore((s) => s.updateUserProfile);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const { data: me, isLoading, isError, refetch } = useMyProfile();
  const updateMyProfile = useUpdateMyProfile();
  const uploadMyAvatar = useUploadMyAvatar();

  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    username: "",
    bio: "",
    twitterUsername: "",
    githubUsername: "",
    websiteUrl: "",
  });

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const initialDataRef = useRef<ProfileFormData | null>(null);
  const initialAvatarUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (!me) {
      return;
    }
    const initial: ProfileFormData = {
      name: me.name ?? "",
      username: me.username ?? "",
      bio: me.bio ?? "",
      twitterUsername: me.twitterUsername ?? "",
      githubUsername: me.githubUsername ?? "",
      websiteUrl: me.websiteUrl ?? "",
    };
    const uri = me.avatarUrl ?? me.image ?? null;
    setFormData(initial);
    setAvatarUri(uri);
    initialDataRef.current = initial;
    if (initialAvatarUriRef.current === null) {
      initialAvatarUriRef.current = uri;
    }
  }, [me]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  /**
   * フォームフィールドの値を更新する
   *
   * @param field - 更新対象のフィールド名
   * @param value - 新しい値
   */
  const updateField = useCallback((field: keyof ProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handlePickAvatar = useCallback(async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(t("common.errorTitle"), t("profile.edit.permissionError"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  }, [t]);

  const handleSave = useCallback(async () => {
    const validationErrors = validateProfileForm(formData, t);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);

    try {
      const isAvatarChanged = avatarUri !== initialAvatarUriRef.current;
      let latestProfile = me;

      if (isAvatarChanged && avatarUri) {
        latestProfile = await uploadMyAvatar.mutateAsync(avatarUri);
        initialAvatarUriRef.current = latestProfile?.avatarUrl ?? avatarUri;
      }

      const patch = initialDataRef.current ? buildPatch(formData, initialDataRef.current) : null;
      if (patch) {
        latestProfile = await updateMyProfile.mutateAsync(patch);
      }

      updateUserProfile({
        name: latestProfile?.name ?? formData.name,
        image: latestProfile?.avatarUrl ?? latestProfile?.image ?? null,
      });

      showToast(t("profile.edit.saveSuccess"), "success");
      router.back();
    } catch (err) {
      if (isApiErrorPayload(err)) {
        if (err.error.code === ERROR_CODE_DUPLICATE) {
          setErrors({ username: t("profile.edit.usernameDuplicate") });
          return;
        }
        if (err.error.code === ERROR_CODE_VALIDATION_FAILED && err.error.details) {
          const fieldErrors: FormErrors = {};
          for (const detail of err.error.details) {
            const field = detail.field as keyof ProfileFormData;
            if (field) {
              fieldErrors[field] = detail.message;
            }
          }
          setErrors(fieldErrors);
          return;
        }
      }
      Alert.alert(t("common.errorTitle"), t("profile.edit.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [
    formData,
    avatarUri,
    me,
    router,
    showToast,
    t,
    updateMyProfile,
    uploadMyAvatar,
    updateUserProfile,
  ]);

  const displayName = formData.name || me?.name || "";

  if (isLoading) {
    return (
      <View
        testID="profile-edit-screen"
        className="flex-1 bg-background items-center justify-center"
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (isError) {
    return (
      <View
        testID="profile-edit-screen"
        className="flex-1 bg-background items-center justify-center px-4"
      >
        <Text className="text-text text-center mb-4">{t("profile.edit.loadFailed")}</Text>
        <Button onPress={() => refetch()}>{t("profile.edit.retryButton")}</Button>
      </View>
    );
  }

  return (
    <View testID="profile-edit-screen" className="flex-1 bg-background">
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={dismissToast}
      />
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-surface border-b border-border">
        <Pressable
          testID="profile-edit-back-button"
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={t("profile.back")}
          hitSlop={8}
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={colors.text} />
        </Pressable>
        <Text className="text-lg font-bold text-text">{t("profile.edit.title")}</Text>
        <View style={{ width: BACK_ICON_SIZE }} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center pt-6 pb-4">
          <Pressable
            testID="profile-edit-avatar-button"
            onPress={handlePickAvatar}
            accessibilityRole="button"
            accessibilityLabel={t("profile.edit.avatarLabel")}
          >
            {avatarUri ? (
              <Image
                testID="profile-edit-avatar-image"
                source={{ uri: avatarUri }}
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: AVATAR_SIZE / 2,
                }}
                contentFit="cover"
              />
            ) : (
              <View
                testID="profile-edit-avatar-fallback"
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: AVATAR_SIZE / 2,
                  backgroundColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 28,
                    fontWeight: "bold",
                  }}
                >
                  {getInitials(displayName || "U")}
                </Text>
              </View>
            )}
            <View
              testID="profile-edit-camera-badge"
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={CAMERA_ICON_SIZE} color={colors.white} />
            </View>
          </Pressable>
        </View>

        <View className="px-4 gap-4">
          <Input
            testID="profile-edit-name-input"
            label={t("profile.edit.nameLabel")}
            placeholder={t("profile.edit.namePlaceholder")}
            value={formData.name}
            onChangeText={(text) => updateField("name", text)}
            error={errors.name}
            autoCapitalize="words"
          />

          <Input
            testID="profile-edit-username-input"
            label={t("profile.edit.usernameLabel")}
            placeholder={t("profile.edit.usernamePlaceholder")}
            value={formData.username}
            onChangeText={(text) => updateField("username", text)}
            error={errors.username}
            autoCapitalize="none"
          />

          <Input
            testID="profile-edit-bio-input"
            label={t("profile.edit.bioLabel")}
            placeholder={t("profile.edit.bioPlaceholder")}
            value={formData.bio}
            onChangeText={(text) => updateField("bio", text)}
            error={errors.bio}
            autoCapitalize="sentences"
          />

          <View className="pt-2">
            <Text className="text-text font-semibold text-base mb-3">
              {t("profile.edit.snsLinks")}
            </Text>

            <View className="gap-4">
              <Input
                testID="profile-edit-twitter-input"
                label={t("profile.edit.twitterUsernameLabel")}
                placeholder={t("profile.edit.twitterUsernamePlaceholder")}
                value={formData.twitterUsername}
                onChangeText={(text) => updateField("twitterUsername", text)}
                error={errors.twitterUsername}
                autoCapitalize="none"
              />

              <Input
                testID="profile-edit-github-input"
                label={t("profile.edit.githubUsernameLabel")}
                placeholder={t("profile.edit.githubUsernamePlaceholder")}
                value={formData.githubUsername}
                onChangeText={(text) => updateField("githubUsername", text)}
                error={errors.githubUsername}
                autoCapitalize="none"
              />

              <Input
                testID="profile-edit-website-input"
                label={t("profile.edit.websiteUrlLabel")}
                placeholder={t("profile.edit.websiteUrlPlaceholder")}
                value={formData.websiteUrl}
                onChangeText={(text) => updateField("websiteUrl", text)}
                error={errors.websiteUrl}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View className="pt-4">
            {isSaving ? (
              <View className="rounded-lg items-center justify-center px-4 py-2.5 bg-primary opacity-50">
                <ActivityIndicator color={colors.white} />
              </View>
            ) : (
              <Button testID="profile-edit-save-button" onPress={handleSave} disabled={isSaving}>
                {t("profile.edit.saveButton")}
              </Button>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
