import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ExternalLink, Globe, Heart, Languages, Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";

import { Badge } from "@/components/ui";
import {
  useArticleDetail,
  useRequestSummary,
  useRequestTranslation,
  useSummaryJobStatus,
  useToggleFavorite,
  useTranslationJobStatus,
} from "@/hooks/use-articles";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { UI_COLORS } from "@/lib/constants";
import { toSummaryLanguageCode, toTranslationLanguageCode } from "@/lib/language-code";
import { getOfflineArticleById } from "@/lib/localDb";
import { useSettingsStore } from "@/stores/settings-store";
import type { ArticleDetail } from "@/types/article";

/** 戻るアイコンサイズ */
const BACK_ICON_SIZE = 24;

/** アクションボタンアイコンサイズ */
const ACTION_ICON_SIZE = 20;

/** ヘッダーアイコンサイズ */
const HEADER_ICON_SIZE = 20;

/** セクション内アイコンサイズ */
const SECTION_ICON_SIZE = 16;

/** お気に入りアクティブカラー */
const FAVORITE_ACTIVE_COLOR = UI_COLORS.error;

/** お気に入り非アクティブカラー */
const FAVORITE_INACTIVE_COLOR = UI_COLORS.textMuted;

/** プライマリカラー */
const PRIMARY_COLOR = UI_COLORS.primary;

/** テキストカラー */
const TEXT_COLOR = UI_COLORS.text;

/** リンク・アクセントカラー */
const ACCENT_COLOR = UI_COLORS.primaryLight;

/** カード背景カラー */
const CARD_BG_COLOR = UI_COLORS.card;

/** コードブロック背景カラー */
const CODE_BG_COLOR = UI_COLORS.surface;

/** 区切り線カラー */
const DIVIDER_COLOR = UI_COLORS.border;

/** 成功カラー */
const SUCCESS_COLOR = UI_COLORS.success;

/** 成功時の背景カラー */
const SUCCESS_BG_COLOR = UI_COLORS.successSurface;

/** ジョブステータスのポーリング間隔（ミリ秒） */
const JOB_POLL_INTERVAL_MS = 2500;

/** Markdownのスタイル定義 */
const markdownStyles = {
  body: {
    color: TEXT_COLOR,
    fontSize: 16,
    lineHeight: 26,
  },
  heading1: {
    color: TEXT_COLOR,
    fontSize: 24,
    fontWeight: "bold" as const,
    marginTop: 24,
    marginBottom: 12,
  },
  heading2: {
    color: TEXT_COLOR,
    fontSize: 20,
    fontWeight: "bold" as const,
    marginTop: 20,
    marginBottom: 10,
  },
  heading3: {
    color: TEXT_COLOR,
    fontSize: 18,
    fontWeight: "600" as const,
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    color: TEXT_COLOR,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 12,
  },
  link: {
    color: ACCENT_COLOR,
  },
  blockquote: {
    backgroundColor: CARD_BG_COLOR,
    borderLeftColor: PRIMARY_COLOR,
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  code_inline: {
    backgroundColor: CARD_BG_COLOR,
    color: ACCENT_COLOR,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 14,
  },
  code_block: {
    backgroundColor: CODE_BG_COLOR,
    color: TEXT_COLOR,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 22,
  },
  fence: {
    backgroundColor: CODE_BG_COLOR,
    color: TEXT_COLOR,
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 22,
  },
  list_item: {
    color: TEXT_COLOR,
    fontSize: 16,
    lineHeight: 26,
  },
  hr: {
    backgroundColor: DIVIDER_COLOR,
    height: 1,
    marginVertical: 16,
  },
  image: {
    borderRadius: 8,
  },
};

/**
 * 日付文字列をYYYY/MM/DD形式にフォーマットする
 *
 * @param isoString - ISO 8601形式の日付文字列
 * @returns フォーマットされた日付文字列
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * 記事詳細画面
 *
 * Markdownレンダリング、要約/翻訳ボタン、お気に入りトグルを提供する。
 * オフライン時はローカルDBからキャッシュ済み記事を取得する。
 */
export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const language = useSettingsStore((s) => s.language);
  const { isOffline } = useNetworkStatus();
  const {
    data: onlineArticle,
    isLoading: isOnlineLoading,
    isError: isOnlineError,
    refetch,
  } = useArticleDetail(id);
  const [offlineArticle, setOfflineArticle] = useState<ArticleDetail | null>(null);
  const [isOfflineLoading, setIsOfflineLoading] = useState(false);
  const [isOfflineError, setIsOfflineError] = useState(false);

  useEffect(() => {
    if (!isOffline) {
      setOfflineArticle(null);
      setIsOfflineError(false);
      return;
    }

    setIsOfflineLoading(true);
    setIsOfflineError(false);

    getOfflineArticleById(id)
      .then((cached) => {
        setOfflineArticle(cached);
        if (cached === null) {
          setIsOfflineError(true);
        }
      })
      .catch(() => {
        setOfflineArticle(null);
        setIsOfflineError(true);
      })
      .finally(() => {
        setIsOfflineLoading(false);
      });
  }, [isOffline, id]);

  const article = isOffline ? offlineArticle : onlineArticle;
  const isLoading = isOffline ? isOfflineLoading : isOnlineLoading;
  const isError = isOffline ? isOfflineError : isOnlineError;
  const toggleFavorite = useToggleFavorite();
  const requestSummary = useRequestSummary();
  const requestTranslation = useRequestTranslation();
  const summaryJobStatus = useSummaryJobStatus();
  const translationJobStatus = useTranslationJobStatus();
  const [summaryJob, setSummaryJob] = useState<{ jobId: string; progress: number } | null>(null);
  const [translationJob, setTranslationJob] = useState<{ jobId: string; progress: number } | null>(
    null,
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleToggleFavorite = useCallback(() => {
    if (!article) return;
    toggleFavorite.mutate({ articleId: article.id, isFavorite: article.isFavorite });
  }, [article, toggleFavorite]);

  const handleOpenExternal = useCallback(() => {
    if (!article?.url) return;
    Linking.openURL(article.url);
  }, [article]);

  const handleRequestSummary = useCallback(() => {
    if (!article) return;
    requestSummary.mutate({ articleId: article.id, language: toSummaryLanguageCode(language) });
  }, [article, language, requestSummary]);

  const handleRequestTranslation = useCallback(() => {
    if (!article) return;
    requestTranslation.mutate({
      articleId: article.id,
      targetLanguage: toTranslationLanguageCode(language),
    });
  }, [article, language, requestTranslation]);

  useEffect(() => {
    if (!article || !requestSummary.data?.success) return;

    const data = requestSummary.data.data;
    if (data.status === "completed" || !data.jobId) {
      setSummaryJob(null);
      return;
    }

    setSummaryJob({ jobId: data.jobId, progress: data.progress });
  }, [article, requestSummary.data]);

  useEffect(() => {
    if (!article || !requestTranslation.data?.success) return;

    const data = requestTranslation.data.data;
    if (data.status === "completed" || !data.jobId) {
      setTranslationJob(null);
      return;
    }

    setTranslationJob({ jobId: data.jobId, progress: data.progress });
  }, [article, requestTranslation.data]);

  useEffect(() => {
    if (!article || !summaryJob) return;

    const intervalId = setInterval(() => {
      summaryJobStatus.mutate(
        { articleId: article.id, jobId: summaryJob.jobId },
        {
          onSuccess: (response) => {
            if (!response.success) {
              setSummaryJob(null);
              return;
            }

            if (response.data.status === "completed" || response.data.status === "failed") {
              setSummaryJob(null);
              return;
            }

            setSummaryJob((current) =>
              current
                ? {
                    ...current,
                    progress: Math.max(current.progress, response.data.progress),
                  }
                : current,
            );
          },
        },
      );
    }, JOB_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [article, summaryJob, summaryJobStatus]);

  useEffect(() => {
    if (!article || !translationJob) return;

    const intervalId = setInterval(() => {
      translationJobStatus.mutate(
        { articleId: article.id, jobId: translationJob.jobId },
        {
          onSuccess: (response) => {
            if (!response.success) {
              setTranslationJob(null);
              return;
            }

            if (response.data.status === "completed" || response.data.status === "failed") {
              setTranslationJob(null);
              return;
            }

            setTranslationJob((current) =>
              current
                ? {
                    ...current,
                    progress: Math.max(current.progress, response.data.progress),
                  }
                : current,
            );
          },
        },
      );
    }, JOB_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [article, translationJob, translationJobStatus]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text className="text-text-muted mt-3">読み込み中...</Text>
      </View>
    );
  }

  if (isError || !article) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-4">
        <Text className="text-text-muted text-base text-center">記事の取得に失敗しました</Text>
        <Pressable onPress={() => refetch()} className="mt-4 bg-primary rounded-lg px-6 py-3">
          <Text className="text-white font-semibold">再試行</Text>
        </Pressable>
        <Pressable onPress={handleBack} className="mt-3">
          <Text className="text-primary">戻る</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-surface border-b border-border">
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="戻る"
          hitSlop={8}
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={TEXT_COLOR} />
        </Pressable>
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={handleOpenExternal}
            accessibilityRole="button"
            accessibilityLabel="ブラウザで開く"
            hitSlop={8}
          >
            <ExternalLink size={HEADER_ICON_SIZE} color={FAVORITE_INACTIVE_COLOR} />
          </Pressable>
          <Pressable
            onPress={handleToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={article.isFavorite ? "お気に入り解除" : "お気に入り追加"}
            hitSlop={8}
          >
            <Heart
              size={HEADER_ICON_SIZE}
              color={article.isFavorite ? FAVORITE_ACTIVE_COLOR : FAVORITE_INACTIVE_COLOR}
              fill={article.isFavorite ? FAVORITE_ACTIVE_COLOR : "transparent"}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pt-4 gap-3">
          <View className="flex-row items-center gap-2">
            <Badge>{article.source}</Badge>
            {article.publishedAt && (
              <Text className="text-xs text-text-muted">{formatDate(article.publishedAt)}</Text>
            )}
            {article.readingTimeMinutes && (
              <Text className="text-xs text-text-muted">
                {article.readingTimeMinutes}分で読めます
              </Text>
            )}
          </View>

          <Text className="text-xl font-bold text-text">{article.title}</Text>

          {article.author && <Text className="text-sm text-text-muted">{article.author}</Text>}
        </View>

        <View className="flex-row px-4 pt-4 pb-2 gap-3">
          <Pressable
            onPress={handleRequestSummary}
            disabled={requestSummary.isPending || !!article.summary || !!summaryJob}
            className="flex-row items-center gap-1.5 rounded-lg px-4 py-2.5"
            style={{
              backgroundColor: article.summary ? SUCCESS_BG_COLOR : CARD_BG_COLOR,
              opacity: requestSummary.isPending || summaryJob ? 0.6 : 1,
            }}
            accessibilityRole="button"
            accessibilityLabel="要約を生成"
            testID="summary-button"
          >
            {requestSummary.isPending || summaryJob ? (
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            ) : (
              <Sparkles
                size={ACTION_ICON_SIZE}
                color={article.summary ? SUCCESS_COLOR : PRIMARY_COLOR}
              />
            )}
            <Text
              className="text-sm font-medium"
              style={{ color: article.summary ? SUCCESS_COLOR : ACCENT_COLOR }}
            >
              {article.summary ? "要約済み" : "要約"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleRequestTranslation}
            disabled={requestTranslation.isPending || !!article.translation || !!translationJob}
            className="flex-row items-center gap-1.5 rounded-lg px-4 py-2.5"
            style={{
              backgroundColor: article.translation ? SUCCESS_BG_COLOR : CARD_BG_COLOR,
              opacity: requestTranslation.isPending || translationJob ? 0.6 : 1,
            }}
            accessibilityRole="button"
            accessibilityLabel="翻訳する"
            testID="translation-button"
          >
            {requestTranslation.isPending || translationJob ? (
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            ) : (
              <Languages
                size={ACTION_ICON_SIZE}
                color={article.translation ? SUCCESS_COLOR : PRIMARY_COLOR}
              />
            )}
            <Text
              className="text-sm font-medium"
              style={{ color: article.translation ? SUCCESS_COLOR : ACCENT_COLOR }}
            >
              {article.translation ? "翻訳済み" : "翻訳"}
            </Text>
          </Pressable>
        </View>

        {summaryJob && (
          <View className="mx-4 mt-2 rounded-xl bg-card border border-border p-4">
            <Text className="text-sm font-medium text-text mb-2">生成中...</Text>
            <View
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: CARD_BG_COLOR }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: ACCENT_COLOR,
                  width: `${Math.min(summaryJob.progress, 80)}%`,
                }}
              />
            </View>
          </View>
        )}

        {translationJob && (
          <View className="mx-4 mt-2 rounded-xl bg-card border border-border p-4">
            <Text className="text-sm font-medium text-text mb-2">生成中...</Text>
            <View
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: CARD_BG_COLOR }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: SUCCESS_COLOR,
                  width: `${Math.min(translationJob.progress, 80)}%`,
                }}
              />
            </View>
          </View>
        )}

        {article.summary && (
          <View className="mx-4 mt-2 p-4 rounded-xl bg-card border border-border">
            <View className="flex-row items-center gap-2 mb-2">
              <Sparkles size={SECTION_ICON_SIZE} color={SUCCESS_COLOR} />
              <Text className="text-sm font-semibold text-success">要約</Text>
            </View>
            <Text className="text-sm text-text leading-relaxed">{article.summary}</Text>
          </View>
        )}

        {article.translation && (
          <View className="mx-4 mt-3 p-4 rounded-xl bg-card border border-border">
            <View className="flex-row items-center gap-2 mb-2">
              <Globe size={SECTION_ICON_SIZE} color={ACCENT_COLOR} />
              <Text className="text-sm font-semibold text-primary-light">翻訳</Text>
            </View>
            <Text className="text-sm text-text leading-relaxed">{article.translation}</Text>
          </View>
        )}

        <View className="px-4 pt-4">
          {article.content ? (
            <Markdown style={markdownStyles}>{article.content}</Markdown>
          ) : (
            <View className="items-center py-8">
              <Text className="text-text-muted text-center">記事本文が利用できません</Text>
              <Pressable onPress={handleOpenExternal} className="mt-3 flex-row items-center gap-2">
                <ExternalLink size={SECTION_ICON_SIZE} color={PRIMARY_COLOR} />
                <Text className="text-primary">元の記事を見る</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
