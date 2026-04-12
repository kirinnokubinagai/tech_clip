import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ArrowLeft, Camera } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { useColors } from "@/hooks/use-colors";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";

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

/** SNSリンクの最大文字数 */
const SNS_LINK_MAX_LENGTH = 200;

/** ユーザー名の正規表現（英数字とアンダースコアのみ） */
const USERNAME_REGEX = /^[a-zA-Z0-9_]*$/;

/** プロフィール編集フォームのデータ */
type ProfileFormData = {
  name: string;
  username: string;
  bio: string;
  twitterUrl: string;
  githubUrl: string;
  websiteUrl: string;
};

/** バリデーションエラーの型 */
type FormErrors = Partial<Record<keyof ProfileFormData, string>>;

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
 * @returns エラーオブジェクト。エラーがない場合は空オブジェクト
 */
export function validateProfileForm(data: ProfileFormData): FormErrors {
  const errors: FormErrors = {};

  if (!data.name.trim()) {
    errors.name = "名前を入力してください";
  }
  if (data.name.length > NAME_MAX_LENGTH) {
    errors.name = `名前は${NAME_MAX_LENGTH}文字以内で入力してください`;
  }

  if (data.username && !USERNAME_REGEX.test(data.username)) {
    errors.username = "ユーザー名は英数字とアンダースコアのみ使用できます";
  }
  if (data.username.length > USERNAME_MAX_LENGTH) {
    errors.username = `ユーザー名は${USERNAME_MAX_LENGTH}文字以内で入力してください`;
  }

  if (data.bio.length > BIO_MAX_LENGTH) {
    errors.bio = `自己紹介は${BIO_MAX_LENGTH}文字以内で入力してください`;
  }

  if (data.twitterUrl && data.twitterUrl.length > SNS_LINK_MAX_LENGTH) {
    errors.twitterUrl = `URLは${SNS_LINK_MAX_LENGTH}文字以内で入力してください`;
  }

  if (data.githubUrl && data.githubUrl.length > SNS_LINK_MAX_LENGTH) {
    errors.githubUrl = `URLは${SNS_LINK_MAX_LENGTH}文字以内で入力してください`;
  }

  if (data.websiteUrl && data.websiteUrl.length > SNS_LINK_MAX_LENGTH) {
    errors.websiteUrl = `URLは${SNS_LINK_MAX_LENGTH}文字以内で入力してください`;
  }

  return errors;
}

/**
 * プロフィール編集画面
 *
 * 名前、ユーザー名、bio、SNSリンクの編集とアバター変更を提供する。
 * NativeWindダークテーマ対応。
 */
export default function ProfileEditScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const [formData, setFormData] = useState<ProfileFormData>({
    name: user?.name ?? "",
    username: "",
    bio: "",
    twitterUrl: "",
    githubUrl: "",
    websiteUrl: "",
  });

  const [avatarUri, setAvatarUri] = useState<string | null>(user?.image ?? null);
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
      Alert.alert("権限エラー", "画像ライブラリへのアクセスが許可されていません");
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
  }, []);

  const handleSave = useCallback(async () => {
    const validationErrors = validateProfileForm(formData);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      showToast("プロフィールを更新しました", "success");
      router.back();
    } catch {
      Alert.alert("エラー", "プロフィールの保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }, [formData, router, showToast]);

  const displayName = formData.name || user?.name || "";

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
          accessibilityLabel="戻る"
          hitSlop={8}
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={COLORS.text} />
        </Pressable>
        <Text className="text-lg font-bold text-text">プロフィール編集</Text>
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
            accessibilityLabel="アバター画像を変更"
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
                  backgroundColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
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
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={CAMERA_ICON_SIZE} color={COLORS.white} />
            </View>
          </Pressable>
        </View>

        <View className="px-4 gap-4">
          <Input
            label="名前"
            placeholder="名前を入力"
            value={formData.name}
            onChangeText={(text) => updateField("name", text)}
            error={errors.name}
            autoCapitalize="words"
          />

          <Input
            label="ユーザー名"
            placeholder="username"
            value={formData.username}
            onChangeText={(text) => updateField("username", text)}
            error={errors.username}
            autoCapitalize="none"
          />

          <Input
            label="自己紹介"
            placeholder="自己紹介を入力"
            value={formData.bio}
            onChangeText={(text) => updateField("bio", text)}
            error={errors.bio}
            autoCapitalize="sentences"
          />

          <View className="pt-2">
            <Text className="text-text font-semibold text-base mb-3">SNSリンク</Text>

            <View className="gap-4">
              <Input
                label="X (Twitter)"
                placeholder="https://x.com/username"
                value={formData.twitterUrl}
                onChangeText={(text) => updateField("twitterUrl", text)}
                error={errors.twitterUrl}
                keyboardType="url"
                autoCapitalize="none"
              />

              <Input
                label="GitHub"
                placeholder="https://github.com/username"
                value={formData.githubUrl}
                onChangeText={(text) => updateField("githubUrl", text)}
                error={errors.githubUrl}
                keyboardType="url"
                autoCapitalize="none"
              />

              <Input
                label="ウェブサイト"
                placeholder="https://example.com"
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
                <ActivityIndicator color={COLORS.white} />
              </View>
            ) : (
              <Button onPress={handleSave} disabled={isSaving}>
                保存する
              </Button>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
