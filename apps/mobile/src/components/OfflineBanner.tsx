import { WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { useNetworkStatus } from "@/hooks/use-network-status";
import { DARK_COLORS } from "@/lib/constants";

/** オフラインアイコンのサイズ（px） */
const OFFLINE_ICON_SIZE = 16;

/** オフラインアイコンのカラー */
const OFFLINE_ICON_COLOR = DARK_COLORS.white;

/**
 * オフライン時に画面上部に表示するバナーコンポーネント
 *
 * ネットワーク接続が切断されている場合のみ表示される。
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const { isOffline } = useNetworkStatus();

  if (!isOffline) {
    return null;
  }

  return (
    <View
      testID="offline-banner"
      className="bg-error flex-row items-center justify-center gap-2 px-4 py-2"
      accessibilityRole="alert"
      accessibilityLabel={t("common.accessibility.offline")}
    >
      <WifiOff size={OFFLINE_ICON_SIZE} color={OFFLINE_ICON_COLOR} />
      <Text className="text-white text-sm font-medium">{t("common.offline")}</Text>
    </View>
  );
}
