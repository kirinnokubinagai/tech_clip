import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { ArticleActionBar } from "@/components/ArticleActionBar";
import { ArticleDetailHeader } from "@/components/ArticleDetailHeader";
import { ArticleReader } from "@/components/ArticleReader";
import { useArticle } from "@/hooks/use-article";

/** ヘッダー背景色 */
const HEADER_BG = "#13131a";

/** ヘッダーテキスト色 */
const HEADER_TEXT_COLOR = "#e2e8f0";

/** 戻るアイコンサイズ */
const BACK_ICON_SIZE = 24;

/**
 * 記事詳細画面
 * URLパラメータからIDを取得し、記事詳細をAPIから取得して表示する
 */
export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: article, isLoading, error } = useArticle(id ?? "");

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            headerStyle: { backgroundColor: HEADER_BG },
            headerTintColor: HEADER_TEXT_COLOR,
            headerShadowVisible: false,
            title: "",
            headerLeft: () => (
              <Pressable onPress={() => router.back()} accessibilityLabel="戻る">
                <ArrowLeft size={BACK_ICON_SIZE} color={HEADER_TEXT_COLOR} />
              </Pressable>
            ),
          }}
        />
        <View className="flex-1 bg-background items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </>
    );
  }

  if (error || !article) {
    return (
      <>
        <Stack.Screen
          options={{
            headerStyle: { backgroundColor: HEADER_BG },
            headerTintColor: HEADER_TEXT_COLOR,
            headerShadowVisible: false,
            title: "",
            headerLeft: () => (
              <Pressable onPress={() => router.back()} accessibilityLabel="戻る">
                <ArrowLeft size={BACK_ICON_SIZE} color={HEADER_TEXT_COLOR} />
              </Pressable>
            ),
          }}
        />
        <View className="flex-1 bg-background items-center justify-center p-6">
          <Text className="text-error text-base text-center">
            {error?.message ?? "記事の読み込みに失敗しました"}
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: HEADER_BG },
          headerTintColor: HEADER_TEXT_COLOR,
          headerShadowVisible: false,
          title: "",
          headerLeft: () => (
            <Pressable onPress={() => router.back()} accessibilityLabel="戻る">
              <ArrowLeft size={BACK_ICON_SIZE} color={HEADER_TEXT_COLOR} />
            </Pressable>
          ),
        }}
      />
      <ScrollView className="flex-1 bg-background">
        <View className="px-4 py-4">
          <ArticleDetailHeader
            title={article.title}
            source={article.source}
            author={article.author}
            publishedAt={article.publishedAt}
          />

          <ArticleActionBar
            articleUrl={article.url}
            isFavorite={article.isFavorite}
            hasSummary={article.summary !== null}
            hasTranslation={article.translation !== null}
            onToggleFavorite={() => {
              /* TODO: お気に入りトグルAPI呼び出し */
            }}
            onRequestSummary={() => {
              /* TODO: 要約リクエストAPI呼び出し */
            }}
            onRequestTranslation={() => {
              /* TODO: 翻訳リクエストAPI呼び出し */
            }}
          />

          {article.content && <ArticleReader content={article.content} />}

          {!article.content && (
            <View className="items-center py-12">
              <Text className="text-text-muted text-base">
                本文がありません。元記事をご確認ください。
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
