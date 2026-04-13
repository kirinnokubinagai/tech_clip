import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

import type { Language } from "../../src/stores/settings-store";
import { LANGUAGE_LABEL_MAP, useSettingsStore } from "../../src/stores/settings-store";

/** チェックアイコンサイズ */
const CHECK_ICON_SIZE = 20;

/** 言語選択画面の行アイテムのProps型 */
type LanguageRowProps = {
  code: Language;
  label: string;
  isSelected: boolean;
  onSelect: (code: Language) => void;
};

/**
 * 言語選択画面の行アイテムコンポーネント
 *
 * @param code - 言語コード
 * @param label - 表示名
 * @param isSelected - 現在選択中かどうか
 * @param onSelect - 選択時のコールバック
 */
function LanguageRow({ code, label, isSelected, onSelect }: LanguageRowProps) {
  const colors = useColors();
  return (
    <Pressable
      testID={`language-option-${code}`}
      onPress={() => onSelect(code)}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={label}
    >
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <Text className="text-base text-text">{label}</Text>
        {isSelected ? (
          <View testID={`language-check-${code}`}>
            <Check size={CHECK_ICON_SIZE} color={colors.primary} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * 言語選択画面
 *
 * FlatList で LANGUAGE_LABEL_MAP を展開し、選択中言語に Check アイコンを表示する
 */
export default function LanguageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const languageEntries = (Object.keys(LANGUAGE_LABEL_MAP) as Language[]).map(
    (code) => [code, LANGUAGE_LABEL_MAP[code]] as [Language, string],
  );

  /**
   * 言語を選択して前の画面に戻る
   *
   * @param code - 選択した言語コード
   */
  async function handleSelect(code: Language) {
    await setLanguage(code);
    router.back();
  }

  return (
    <View className="flex-1 bg-background">
      <Text className="text-xs font-semibold text-text-dim uppercase tracking-wider px-4 pt-4 pb-2">
        {t("settings.languageSelect.title")}
      </Text>
      <View className="bg-surface mx-4 rounded-xl border border-border overflow-hidden">
        <FlatList
          data={languageEntries}
          keyExtractor={([code]) => code}
          renderItem={({ item: [code, label] }) => (
            <LanguageRow
              code={code}
              label={label}
              isSelected={language === code}
              onSelect={handleSelect}
            />
          )}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}
