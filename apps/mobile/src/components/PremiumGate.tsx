import { Check, X } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

/** PremiumGateコンポーネントのprops */
export type PremiumGateProps = {
  /** 現在のAI機能使用回数 */
  currentUsage: number;
  /** 無料プランの最大使用回数 */
  maxUsage: number;
  /** プレミアムプランで利用可能な機能一覧 */
  features: string[];
  /** 購入ボタンタップ時のコールバック */
  onPurchase: () => void;
  /** 閉じるボタンタップ時のコールバック */
  onClose: () => void;
};

/** チェックアイコンのサイズ（px） */
const CHECK_ICON_SIZE = 16;

/** 閉じるアイコンのサイズ（px） */
const CLOSE_ICON_SIZE = 20;

/**
 * プレミアムプラン誘導UIコンポーネント
 *
 * AI機能の使用回数超過時に表示する。
 * プレミアム機能一覧、使用量、購入ボタンを含む。
 *
 * @param currentUsage - 現在の使用回数
 * @param maxUsage - 最大使用回数
 * @param features - プレミアム機能一覧
 * @param onPurchase - 購入ボタンタップ時のコールバック
 * @param onClose - 閉じるボタンタップ時のコールバック
 */
export function PremiumGate({
  currentUsage,
  maxUsage,
  features,
  onPurchase,
  onClose,
}: PremiumGateProps) {
  const { t } = useTranslation();
  const colors = useColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          paddingHorizontal: 24,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 24,
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        },
        headerTitle: {
          fontSize: 20,
          fontWeight: "bold",
          color: colors.text,
        },
        closeButton: {
          padding: 4,
        },
        usageCard: {
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          alignItems: "center",
        },
        usageLabel: {
          fontSize: 14,
          color: colors.textMuted,
          marginBottom: 4,
        },
        usageCount: {
          fontSize: 30,
          fontWeight: "bold",
          color: colors.text,
        },
        usageLimit: {
          fontSize: 14,
          color: colors.error,
          marginTop: 4,
        },
        featuresTitle: {
          fontSize: 16,
          fontWeight: "600",
          color: colors.text,
          marginBottom: 12,
        },
        featuresList: {
          marginBottom: 24,
        },
        featureItem: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        },
        featureText: {
          fontSize: 14,
          color: colors.text,
          flex: 1,
        },
        purchaseButton: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: "center",
        },
        purchaseButtonText: {
          fontSize: 16,
          fontWeight: "600",
          color: colors.white,
        },
      }),
    [colors],
  );

  return (
    <View testID="premium-gate-container" style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("premium.title")}</Text>
          <Pressable
            testID="close-button"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.accessibility.close")}
            hitSlop={8}
            style={styles.closeButton}
          >
            <X size={CLOSE_ICON_SIZE} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.usageCard}>
          <Text style={styles.usageLabel}>{t("premium.monthlyUsage")}</Text>
          <Text style={styles.usageCount}>{`${currentUsage} / ${maxUsage}`}</Text>
          {currentUsage >= maxUsage && (
            <Text style={styles.usageLimit}>{t("premium.limitReached")}</Text>
          )}
        </View>

        <Text style={styles.featuresTitle}>{t("premium.featuresTitle")}</Text>

        <ScrollView style={styles.featuresList} showsVerticalScrollIndicator={false}>
          {features.map((feature) => (
            <View key={feature} style={styles.featureItem}>
              <Check size={CHECK_ICON_SIZE} color={colors.primary} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </ScrollView>

        <Pressable
          testID="purchase-button"
          onPress={onPurchase}
          accessibilityRole="button"
          accessibilityLabel={t("common.accessibility.purchasePremium")}
          style={styles.purchaseButton}
        >
          <Text style={styles.purchaseButtonText}>{t("premium.purchaseButton")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
