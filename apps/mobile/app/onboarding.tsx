import { router } from "expo-router";
import { ArrowRight, BookMarked, Sparkles, Tag } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { LIGHT_COLORS, SUPPORTED_SOURCE_COUNT } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { requestTrackingPermission } from "@/lib/tracking";
import { useUIStore } from "@/stores/ui-store";

/** オンボーディングページのメタデータ（IDとアイコンのみ保持） */
const ONBOARDING_PAGE_META = [
  { id: "save", Icon: BookMarked },
  { id: "ai", Icon: Sparkles },
  { id: "organize", Icon: Tag },
  { id: "start", Icon: ArrowRight },
] as const;

/** ページ数 */
const PAGE_COUNT = ONBOARDING_PAGE_META.length;

/**
 * オンボーディング画面
 * 初回起動時のみ表示される4ページのウォークスルー
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const hasSeenOnboarding = useUIStore((s) => s.hasSeenOnboarding);
  const setHasSeenOnboarding = useUIStore((s) => s.setHasSeenOnboarding);

  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastPage = currentIndex === PAGE_COUNT - 1;
  const currentPageMeta = ONBOARDING_PAGE_META[currentIndex];

  const handleFinish = async () => {
    try {
      await requestTrackingPermission();
    } catch (error) {
      logger.warn("トラッキング権限リクエストに失敗しました", { error });
    }
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

  const pageId = currentPageMeta.id;
  const pageTitle = t(`onboarding.pages.${pageId}.title`);
  const pageDescription =
    pageId === "save"
      ? t("onboarding.pages.save.description", { count: SUPPORTED_SOURCE_COUNT })
      : t(`onboarding.pages.${pageId}.description`);

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} scrollEnabled={false}>
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-8 h-24 w-24 items-center justify-center rounded-2xl bg-stone-100">
            <currentPageMeta.Icon size={48} color={LIGHT_COLORS.neutral} strokeWidth={1.5} />
          </View>
          <Text
            testID="onboarding-title"
            className="mb-4 text-center text-2xl font-bold text-stone-900"
          >
            {pageTitle}
          </Text>
          <Text className="text-center text-base leading-relaxed text-stone-500">
            {pageDescription}
          </Text>
        </View>
      </ScrollView>

      {/* ページインジケーター */}
      <View
        testID="page-indicator"
        className="flex-row items-center justify-center py-4"
        accessibilityLabel={t("onboarding.accessibility.pageIndicator", {
          current: currentIndex + 1,
          total: PAGE_COUNT,
        })}
        accessible={true}
      >
        {ONBOARDING_PAGE_META.map((page, index) => (
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
          accessibilityLabel={t("onboarding.skip")}
          accessibilityHint={t("onboarding.accessibility.skipHint")}
        >
          <Text className="text-base text-stone-500">{t("onboarding.skip")}</Text>
        </Pressable>

        {isLastPage ? (
          <Pressable
            testID="finish-button"
            onPress={handleFinish}
            className="rounded-xl bg-stone-800 px-8 py-3"
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.start")}
            accessibilityHint={t("onboarding.accessibility.startHint")}
          >
            <Text className="text-base font-semibold text-white">{t("onboarding.start")}</Text>
          </Pressable>
        ) : (
          <Pressable
            testID="next-button"
            onPress={handleNext}
            className="rounded-xl bg-stone-800 px-8 py-3"
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.next")}
            accessibilityHint={t("onboarding.accessibility.nextPageHint", {
              next: currentIndex + 2,
            })}
          >
            <Text className="text-base font-semibold text-white">{t("onboarding.next")}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
