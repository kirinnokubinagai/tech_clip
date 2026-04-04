import { router } from "expo-router";
import { ArrowRight, BookMarked, Sparkles, Tag } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DARK_COLORS, SUPPORTED_SOURCE_COUNT } from "@/lib/constants";
import { useUIStore } from "../src/stores/ui-store";

/** オンボーディングページのデータ */
const ONBOARDING_PAGES = [
  {
    id: "save",
    title: "技術記事をワンタップで保存",
    description: `Zenn、Qiita、dev.toなど${SUPPORTED_SOURCE_COUNT}ソースに対応。気になった記事をすぐ保存できます。`,
    Icon: BookMarked,
  },
  {
    id: "ai",
    title: "AIが要約・翻訳",
    description: "英語記事も日本語で読める。要点だけ把握したいときはAI要約で時短。",
    Icon: Sparkles,
  },
  {
    id: "organize",
    title: "お気に入り・タグで整理",
    description: "タグ付けで記事を分類。お気に入り登録でいつでも素早くアクセス。",
    Icon: Tag,
  },
  {
    id: "start",
    title: "さあ、始めましょう",
    description: "アカウントを作成して、技術知識を効率よく管理しましょう。",
    Icon: ArrowRight,
  },
] as const;

/** ページ数 */
const PAGE_COUNT = ONBOARDING_PAGES.length;

/**
 * オンボーディング画面
 * 初回起動時のみ表示される4ページのウォークスルー
 */
export default function OnboardingScreen() {
  const hasSeenOnboarding = useUIStore((s) => s.hasSeenOnboarding);
  const setHasSeenOnboarding = useUIStore((s) => s.setHasSeenOnboarding);

  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastPage = currentIndex === PAGE_COUNT - 1;
  const currentPage = ONBOARDING_PAGES[currentIndex];

  const handleFinish = async () => {
    await setHasSeenOnboarding(true);
    router.replace("/(auth)/login");
  };

  const handleSkip = async () => {
    await setHasSeenOnboarding(true);
    router.replace("/(auth)/login");
  };

  const handleNext = () => {
    setCurrentIndex(currentIndex + 1);
  };

  if (hasSeenOnboarding) {
    return null;
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled={false}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-8 h-24 w-24 items-center justify-center rounded-2xl bg-stone-100">
            <currentPage.Icon size={48} color={DARK_COLORS.neutral} strokeWidth={1.5} />
          </View>
          <Text
            testID="onboarding-title"
            className="mb-4 text-center text-2xl font-bold text-stone-900"
          >
            {currentPage.title}
          </Text>
          <Text className="text-center text-base leading-relaxed text-stone-500">
            {currentPage.description}
          </Text>
        </View>
      </ScrollView>

      {/* ページインジケーター */}
      <View
        testID="page-indicator"
        className="flex-row items-center justify-center py-4"
        accessibilityLabel={`${currentIndex + 1}ページ目（全${PAGE_COUNT}ページ）`}
        accessible={true}
      >
        {ONBOARDING_PAGES.map((page, index) => (
          <View
            key={page.id}
            className={`mx-1 h-2 rounded-full ${
              index === currentIndex ? "w-6 bg-stone-700" : "w-2 bg-stone-300"
            }`}
            accessibilityElementsHidden={true}
            importantForAccessibility="no-hide-descendants"
          />
        ))}
      </View>

      {/* ボタンエリア */}
      <View className="flex-row items-center justify-between px-6 pb-12 pt-2">
        <Pressable
          testID="skip-button"
          onPress={handleSkip}
          className="px-4 py-3"
          accessibilityRole="button"
          accessibilityLabel="スキップ"
          accessibilityHint="オンボーディングをスキップしてログイン画面に進みます"
        >
          <Text className="text-base text-stone-500">スキップ</Text>
        </Pressable>

        {isLastPage ? (
          <Pressable
            testID="finish-button"
            onPress={handleFinish}
            className="rounded-xl bg-stone-800 px-8 py-3"
            accessibilityRole="button"
            accessibilityLabel="始める"
            accessibilityHint="アカウント作成画面に進みます"
          >
            <Text className="text-base font-semibold text-white">始める</Text>
          </Pressable>
        ) : (
          <Pressable
            testID="next-button"
            onPress={handleNext}
            className="rounded-xl bg-stone-800 px-8 py-3"
            accessibilityRole="button"
            accessibilityLabel="次へ"
            accessibilityHint={`次のページ（${currentIndex + 2}ページ目）に進みます`}
          >
            <Text className="text-base font-semibold text-white">次へ</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
