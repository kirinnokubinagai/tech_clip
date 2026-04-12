import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { AlertCircle, ArrowLeft, ExternalLink, Loader2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, Input, SourceBadge, Toast } from "@/components/ui";
import { useColors } from "@/hooks/use-colors";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import type { ArticlePreview, ParseArticleResponse, SaveArticleResponse } from "@/types/article";

/** URL正規表現パターン */
const URL_PATTERN = /^https?:\/\/.+/;

/** サムネイル画像の高さ */
const THUMBNAIL_HEIGHT = 160;

/** ソースバッジのアイコンサイズ */
const ICON_SIZE_SM = 14;

/** 戻るボタンのアイコンサイズ */
const ICON_SIZE_LG = 24;

/** エラーアイコンのサイズ */
const ERROR_ICON_SIZE = 16;

/**
 * URL入力のクライアントバリデーション
 *
 * @param url - 検証するURL文字列
 * @returns エラーメッセージ。有効な場合はnull
 */
function validateUrl(url: string): string | null {
  if (!url.trim()) {
    return "URLを入力してください";
  }
  if (!URL_PATTERN.test(url.trim())) {
    return "有効なURLを入力してください";
  }
  return null;
}

/**
 * 記事保存画面
 *
 * URL入力 -> APIでパース -> プレビュー表示 -> 保存確認のフロー。
 * NativeWindダークテーマ、authStore + apiFetch使用。
 */
export default function SaveScreen() {
  const COLORS = useColors();
  const { url: sharedUrl } = useLocalSearchParams<{ url?: string }>();
  const [url, setUrl] = useState(sharedUrl ?? "");
  const [preview, setPreview] = useState<ArticlePreview | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  /**
   * URLから記事をパースしてプレビュー表示する
   */
  const handleFetch = useCallback(async () => {
    setErrorMessage(null);
    setPreview(null);

    const validationError = validateUrl(url);
    if (validationError) {
      setUrlError(validationError);
      return;
    }

    setUrlError(null);
    setIsFetching(true);

    try {
      const data = await apiFetch<ParseArticleResponse>("/api/articles/parse", {
        method: "POST",
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!data.success) {
        setErrorMessage(data.error.message);
        return;
      }

      setPreview(data.data);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      setErrorMessage("記事の取得に失敗しました");
    } finally {
      setIsFetching(false);
    }
  }, [url]);

  /**
   * プレビュー済みの記事をPOST /api/articlesで保存する
   */
  const handleSave = useCallback(async () => {
    if (!preview) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const data = await apiFetch<SaveArticleResponse>("/api/articles", {
        method: "POST",
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!data.success) {
        setErrorMessage(data.error.message);
        return;
      }

      showToast("記事を保存しました", "success");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      setErrorMessage("記事の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }, [preview, url, showToast]);

  return (
    <View className="flex-1">
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={dismissToast}
      />
      <ScrollView className="flex-1 bg-background" keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-4 pb-8">
          {/* ヘッダー */}
          <View className="flex-row items-center mb-6">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="戻る"
              accessibilityHint="前の画面に戻ります"
              className="mr-3 p-1"
            >
              <ArrowLeft size={ICON_SIZE_LG} color={COLORS.text} />
            </Pressable>
            <Text className="text-xl font-bold text-text">記事を保存</Text>
          </View>

          {/* URL入力 */}
          <View className="mb-4">
            <Input
              label="URL"
              placeholder="https://"
              value={url}
              onChangeText={(text) => {
                setUrl(text);
                setUrlError(null);
              }}
              error={urlError ?? undefined}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          {/* 取得ボタン */}
          <View className="mb-6">
            <Button
              testID="fetch-button"
              onPress={handleFetch}
              disabled={isFetching}
              loading={isFetching}
            >
              取得
            </Button>
          </View>

          {/* ローディング */}
          {isFetching && (
            <View testID="fetch-loading" className="items-center py-8">
              <Loader2 size={ICON_SIZE_LG} color={COLORS.primary} />
              <Text className="mt-2 text-text-muted text-sm">記事を取得中...</Text>
            </View>
          )}

          {/* エラーメッセージ */}
          {errorMessage && (
            <View
              className="flex-row items-center gap-2 rounded-lg bg-error/10 border border-error/30 p-3 mb-4"
              accessibilityRole="alert"
              accessibilityLabel={errorMessage}
            >
              <AlertCircle
                size={ERROR_ICON_SIZE}
                color={COLORS.error}
                accessibilityElementsHidden={true}
                importantForAccessibility="no-hide-descendants"
              />
              <Text className="text-error text-sm flex-1">{errorMessage}</Text>
            </View>
          )}

          {/* プレビュー */}
          {preview && !isFetching && (
            <View testID="article-preview">
              <Text className="text-text-muted text-sm font-medium mb-3">プレビュー</Text>
              <Card>
                {/* サムネイル */}
                {preview.thumbnailUrl && (
                  <Image
                    source={{ uri: preview.thumbnailUrl }}
                    className="w-full rounded-lg mb-3"
                    style={{ height: THUMBNAIL_HEIGHT }}
                    resizeMode="cover"
                    accessibilityLabel="記事のサムネイル"
                  />
                )}

                {/* ソースバッジ + 読了時間 */}
                <View className="flex-row items-center gap-2 mb-2">
                  <SourceBadge source={preview.source} />
                  {preview.readingTimeMinutes && (
                    <Text className="text-text-dim text-xs">
                      {preview.readingTimeMinutes}分で読了
                    </Text>
                  )}
                </View>

                {/* タイトル */}
                <Text className="text-text text-lg font-bold mb-2">{preview.title}</Text>

                {/* 著者 */}
                {preview.author && (
                  <Text className="text-text-muted text-sm mb-2">{preview.author}</Text>
                )}

                {/* 概要 */}
                {preview.excerpt && (
                  <Text className="text-text-muted text-sm leading-relaxed mb-3">
                    {preview.excerpt}
                  </Text>
                )}

                {/* URL表示 */}
                <View className="flex-row items-center gap-1">
                  <ExternalLink size={ICON_SIZE_SM} color={COLORS.textDim} />
                  <Text className="text-text-dim text-xs flex-1" numberOfLines={1}>
                    {url.trim()}
                  </Text>
                </View>
              </Card>

              {/* 保存ボタン */}
              <View className="mt-4">
                <Button
                  testID="save-button"
                  onPress={handleSave}
                  disabled={isSaving}
                  loading={isSaving}
                >
                  保存する
                </Button>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
