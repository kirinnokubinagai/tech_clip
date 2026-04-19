import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, BookmarkPlus, ExternalLink, Globe, Heart, Languages, Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import Markdown from "react-native-markdown-display";

import { PremiumGate } from "@/components/PremiumGate";
import { SourceBadge } from "@/components/ui";
import {
  useArticleDetail,
  useCloneArticle,
  useRequestSummary,
  useRequestTranslation,
  useSummaryJobStatus,
  useToggleFavorite,
  useTranslationJobStatus,
} from "@/hooks/use-articles";
import { useColors } from "@/hooks/use-colors";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useSubscription } from "@/hooks/use-subscription";
import { formatArticleDate } from "@/lib/date-format";
import { incrementArticleView } from "@/lib/interstitial-manager";
import { UI_TO_API_LANGUAGE } from "@/lib/language-code";
import {
  getOfflineArticleById,
  upsertArticle,
  upsertSummary,
  upsertTranslation,
} from "@/lib/localDb";
import { getOfferings } from "@/lib/revenueCat";
import { useSettingsStore } from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import type { ArticleDetail } from "@/types/article";

/** AI使用回数上限エラーコード */
const AI_LIMIT_ERROR_CODE = "AI_LIMIT_EXCEEDED";

/** 無料ユーザーの月間AI使用上限回数 */
const FREE_AI_USES_PER_MONTH = 5;

/** プレミアム機能一覧（PremiumGate に渡す） */
const PREMIUM_FEATURES = [
  "article.premiumFeatures.unlimitedAi",
  "article.premiumFeatures.noAds",
  "article.premiumFeatures.offlineAccess",
];

/** 戻るアイコンサイズ */
const BACK_ICON_SIZE = 24;

/** アクションボタンアイコンサイズ */
const ACTION_ICON_SIZE = 20;

/** ヘッダーアイコンサイズ */
const HEADER_ICON_SIZE = 20;

/** セクション内アイコンサイズ */
const SECTION_ICON_SIZE = 16;

/** ジョブステータスのポーリング間隔（ミリ秒） */
const JOB_POLL_INTERVAL_MS = 2500;

/**
 * 記事詳細画面
 *
 * Markdownレンダリング、要約/翻訳ボタン、お気に入りトグルを提供する。
 * オフライン時はローカルDBからキャッシュ済み記事を取得する。
 */
export default function ArticleDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { isSubscribed, purchase } = useSubscription();

  /** Markdownのスタイル定義 */
  const markdownStyles = useMemo(
    () => ({
      body: {
        color: colors.text,
        fontSize: 16,
        lineHeight: 26,
      },
      heading1: {
        color: colors.text,
        fontSize: 24,
        fontWeight: "bold" as const,
        marginTop: 24,
        marginBottom: 12,
      },
      heading2: {
        color: colors.text,
        fontSize: 20,
        fontWeight: "bold" as const,
        marginTop: 20,
        marginBottom: 10,
      },
      heading3: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "600" as const,
        marginTop: 16,
        marginBottom: 8,
      },
      paragraph: {
        color: colors.text,
        fontSize: 16,
        lineHeight: 26,
        marginBottom: 12,
      },
      link: {
        color: colors.primaryLight,
      },
      blockquote: {
        backgroundColor: colors.card,
        borderLeftColor: colors.primary,
        borderLeftWidth: 3,
        paddingLeft: 12,
        paddingVertical: 8,
        marginVertical: 8,
      },
      code_inline: {
        backgroundColor: colors.card,
        color: colors.primaryLight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 14,
      },
      code_block: {
        backgroundColor: colors.surface,
        color: colors.text,
        padding: 12,
        borderRadius: 8,
        fontSize: 14,
        lineHeight: 22,
      },
      fence: {
        backgroundColor: colors.surface,
        color: colors.text,
        padding: 12,
        borderRadius: 8,
        fontSize: 14,
        lineHeight: 22,
      },
      list_item: {
        color: colors.text,
        fontSize: 16,
        lineHeight: 26,
      },
      hr: {
        backgroundColor: colors.border,
        height: 1,
        marginVertical: 16,
      },
      image: {
        borderRadius: 8,
      },
    }),
    [colors],
  );

  const language = useSettingsStore((s) => s.language);
  const apiLanguage = UI_TO_API_LANGUAGE[language];
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
    incrementArticleView(isSubscribed);
  }, [isSubscribed]);

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

  useEffect(() => {
    if (isOffline || !onlineArticle) {
      return;
    }
    void upsertArticle(onlineArticle);
    if (onlineArticle.summary) {
      void upsertSummary(onlineArticle.id, onlineArticle.summary);
    }
    if (onlineArticle.translation) {
      void upsertTranslation(onlineArticle.id, onlineArticle.translation);
    }
  }, [isOffline, onlineArticle]);

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
  const [showPremiumGate, setShowPremiumGate] = useState(false);
  const [aiUsageCount, setAiUsageCount] = useState(0);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleToggleFavorite = useCallback(() => {
    if (!article) return;
    toggleFavorite.mutate({ articleId: article.id, isFavorite: article.isFavorite });
  }, [article, toggleFavorite]);

  const cloneArticle = useCloneArticle();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isNotOwner = !!article && !!currentUserId && article.userId !== currentUserId;
  const handleClone = useCallback(() => {
    if (!article) return;
    cloneArticle.mutate(article.id, {
      onSuccess: () => {
        router.replace("/(tabs)");
      },
    });
  }, [article, cloneArticle, router]);

  const handleOpenExternal = useCallback(() => {
    if (!article?.url) return;
    Linking.openURL(article.url);
  }, [article]);

  const handleRequestSummary = useCallback(() => {
    if (!article) return;
    requestSummary.mutate(
      { articleId: article.id, language: apiLanguage },
      {
        onSuccess: (data) => {
          if (!data.success && "error" in data && data.error.code === AI_LIMIT_ERROR_CODE) {
            setAiUsageCount(FREE_AI_USES_PER_MONTH);
            setShowPremiumGate(true);
          }
        },
      },
    );
  }, [article, apiLanguage, requestSummary]);

  const handleRequestTranslation = useCallback(() => {
    if (!article) return;
    requestTranslation.mutate({
      articleId: article.id,
      targetLanguage: apiLanguage,
    });
  }, [article, apiLanguage, requestTranslation]);

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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-text-muted mt-3">{t("article.loadingArticle")}</Text>
      </View>
    );
  }

  if (isError || !article) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-4">
        <Text className="text-text-muted text-base text-center">{t("article.fetchError")}</Text>
        <Pressable onPress={() => refetch()} className="mt-4 bg-primary rounded-lg px-6 py-3">
          <Text className="text-white font-semibold">{t("common.retry")}</Text>
        </Pressable>
        <Pressable onPress={handleBack} className="mt-3">
          <Text className="text-primary">{t("common.back")}</Text>
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
          accessibilityLabel={t("article.backA11yLabel")}
          hitSlop={8}
        >
          <ArrowLeft size={BACK_ICON_SIZE} color={colors.text} />
        </Pressable>
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={handleOpenExternal}
            accessibilityRole="button"
            accessibilityLabel={t("article.openInBrowser")}
            hitSlop={8}
          >
            <ExternalLink size={HEADER_ICON_SIZE} color={colors.textMuted} />
          </Pressable>
          {isNotOwner ? (
            <Pressable
              testID="clone-button"
              onPress={handleClone}
              disabled={cloneArticle.isPending}
              accessibilityRole="button"
              accessibilityLabel="自分のコレクションに保存"
              hitSlop={8}
            >
              <BookmarkPlus
                size={HEADER_ICON_SIZE}
                color={cloneArticle.isPending ? colors.textMuted : colors.primary}
              />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleToggleFavorite}
              accessibilityRole="button"
              accessibilityLabel={
                article.isFavorite ? t("article.removeFromFavorites") : t("article.addToFavorites")
              }
              hitSlop={8}
            >
              <Heart
                size={HEADER_ICON_SIZE}
                color={article.isFavorite ? colors.favorite : colors.textMuted}
                fill={article.isFavorite ? colors.favorite : "transparent"}
              />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pt-4 gap-3">
          <View className="flex-row items-center gap-2">
            <SourceBadge source={article.source} />
            {article.publishedAt && (
              <Text className="text-xs text-text-muted">
                {formatArticleDate(article.publishedAt, language)}
              </Text>
            )}
            {article.readingTimeMinutes && (
              <Text className="text-xs text-text-muted">
                {t("article.readingTime", { minutes: article.readingTimeMinutes })}
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
              backgroundColor: article.summary ? colors.successSurface : colors.card,
              opacity: requestSummary.isPending || summaryJob ? 0.6 : 1,
            }}
            accessibilityRole="button"
            accessibilityLabel={t("article.summarize")}
            testID="summary-button"
          >
            {requestSummary.isPending || summaryJob ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Sparkles
                size={ACTION_ICON_SIZE}
                color={article.summary ? colors.success : colors.primary}
              />
            )}
            <Text
              className="text-sm font-medium"
              style={{ color: article.summary ? colors.success : colors.primaryLight }}
            >
              {article.summary ? t("article.summarized") : t("article.summarize")}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleRequestTranslation}
            disabled={requestTranslation.isPending || !!article.translation || !!translationJob}
            className="flex-row items-center gap-1.5 rounded-lg px-4 py-2.5"
            style={{
              backgroundColor: article.translation ? colors.successSurface : colors.card,
              opacity: requestTranslation.isPending || translationJob ? 0.6 : 1,
            }}
            accessibilityRole="button"
            accessibilityLabel={t("article.translate")}
            testID="translation-button"
          >
            {requestTranslation.isPending || translationJob ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Languages
                size={ACTION_ICON_SIZE}
                color={article.translation ? colors.success : colors.primary}
              />
            )}
            <Text
              className="text-sm font-medium"
              style={{ color: article.translation ? colors.success : colors.primaryLight }}
            >
              {article.translation ? t("article.translated") : t("article.translate")}
            </Text>
          </Pressable>
        </View>

        {summaryJob && (
          <View className="mx-4 mt-2 rounded-xl bg-card border border-border p-4">
            <Text className="text-sm font-medium text-text mb-2">{t("article.generating")}</Text>
            <View
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: colors.card }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: colors.primaryLight,
                  width: `${Math.min(summaryJob.progress, 80)}%`,
                }}
              />
            </View>
          </View>
        )}

        {translationJob && (
          <View className="mx-4 mt-2 rounded-xl bg-card border border-border p-4">
            <Text className="text-sm font-medium text-text mb-2">{t("article.generating")}</Text>
            <View
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: colors.card }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: colors.success,
                  width: `${Math.min(translationJob.progress, 80)}%`,
                }}
              />
            </View>
          </View>
        )}

        {article.summary && (
          <View className="mx-4 mt-2 p-4 rounded-xl bg-card border border-border">
            <View className="flex-row items-center gap-2 mb-2">
              <Sparkles size={SECTION_ICON_SIZE} color={colors.success} />
              <Text className="text-sm font-semibold text-success">{t("article.summary")}</Text>
            </View>
            <Text className="text-sm text-text leading-relaxed">{article.summary}</Text>
          </View>
        )}

        {article.translation && (
          <View className="mx-4 mt-3 p-4 rounded-xl bg-card border border-border">
            <View className="flex-row items-center gap-2 mb-2">
              <Globe size={SECTION_ICON_SIZE} color={colors.primaryLight} />
              <Text className="text-sm font-semibold text-primary-light">
                {t("article.translation")}
              </Text>
            </View>
            <Text className="text-sm text-text leading-relaxed">{article.translation}</Text>
          </View>
        )}

        <View className="px-4 pt-4">
          {article.content ? (
            <Markdown style={markdownStyles}>{article.content}</Markdown>
          ) : isOffline ? (
            <View className="items-center py-8">
              <Text className="text-text-muted text-center">
                {t("article.offlineContentUnavailable")}
              </Text>
            </View>
          ) : (
            <View className="items-center py-8">
              <Text className="text-text-muted text-center">{t("article.noContent")}</Text>
              <Pressable onPress={handleOpenExternal} className="mt-3 flex-row items-center gap-2">
                <ExternalLink size={SECTION_ICON_SIZE} color={colors.primary} />
                <Text className="text-primary">{t("article.viewOriginal")}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={showPremiumGate}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPremiumGate(false)}
      >
        <PremiumGate
          currentUsage={aiUsageCount}
          maxUsage={FREE_AI_USES_PER_MONTH}
          features={PREMIUM_FEATURES.map((key) => t(key))}
          onPurchase={async () => {
            try {
              const packages = await getOfferings();
              if (packages.length > 0) {
                await purchase(packages[0]);
                setShowPremiumGate(false);
              }
            } catch {
              setShowPremiumGate(false);
            }
          }}
          onClose={() => setShowPremiumGate(false)}
        />
      </Modal>
    </View>
  );
}
