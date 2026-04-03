import { Plus, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

type TagPickerProps = {
  tags: readonly string[];
  selectedTags: readonly string[];
  onToggleTag: (tag: string) => void;
  onAddTag?: (tag: string) => void;
  maxTags?: number;
};

/** タグの最大文字数 */
const TAG_MAX_LENGTH = 30;

/** 新規タグ入力欄のプレースホルダー色 */
const PLACEHOLDER_COLOR = "#64748b";

/** アイコンカラー（ミュート） */
const ICON_COLOR_MUTED = "#94a3b8";

/** アイコンサイズ（px） */
const ICON_SIZE = 14;

/** デフォルトの最大タグ選択数 */
const DEFAULT_MAX_TAGS = 10;

/**
 * タグ選択コンポーネント
 *
 * 既存タグの表示・選択と新規タグ追加機能を提供する。
 * NativeWindダークテーマ対応。
 *
 * @param tags - 選択可能なタグ一覧
 * @param selectedTags - 現在選択中のタグ一覧
 * @param onToggleTag - タグ選択/解除時のコールバック
 * @param onAddTag - 新規タグ追加時のコールバック（未指定で入力欄非表示）
 * @param maxTags - 最大選択可能タグ数
 */
export function TagPicker({
  tags,
  selectedTags,
  onToggleTag,
  onAddTag,
  maxTags = DEFAULT_MAX_TAGS,
}: TagPickerProps) {
  const [newTagText, setNewTagText] = useState("");
  const isAtLimit = selectedTags.length >= maxTags;

  const handleAddTag = () => {
    const trimmed = newTagText.trim();
    if (!trimmed) {
      return;
    }
    if (trimmed.length > TAG_MAX_LENGTH) {
      return;
    }
    if (tags.includes(trimmed) || selectedTags.includes(trimmed)) {
      return;
    }
    onAddTag?.(trimmed);
    setNewTagText("");
  };

  return (
    <View testID="tag-picker" className="gap-3">
      <View testID="tag-list" className="flex-row flex-wrap gap-2">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          const isDisabled = !isSelected && isAtLimit;

          return (
            <Pressable
              key={tag}
              testID={`tag-${tag}`}
              onPress={() => {
                if (!isDisabled) {
                  onToggleTag(tag);
                }
              }}
              disabled={isDisabled}
              accessibilityRole="button"
              accessibilityLabel={isSelected ? `${tag}を解除` : `${tag}を選択`}
              accessibilityState={{ selected: isSelected, disabled: isDisabled }}
              className={`flex-row items-center gap-1 rounded-full border px-3 py-1.5 ${
                isSelected
                  ? "bg-primary border-primary"
                  : isDisabled
                    ? "bg-surface border-border opacity-50"
                    : "bg-surface border-border"
              }`}
            >
              <Text className={`text-sm font-medium ${isSelected ? "text-white" : "text-text"}`}>
                {tag}
              </Text>
              {isSelected && <X size={ICON_SIZE} color="#ffffff" />}
            </Pressable>
          );
        })}
      </View>

      {onAddTag && (
        <View testID="tag-add-input" className="flex-row items-center gap-2">
          <TextInput
            testID="tag-input"
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm"
            placeholder="新しいタグを追加"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={newTagText}
            onChangeText={setNewTagText}
            onSubmitEditing={handleAddTag}
            maxLength={TAG_MAX_LENGTH}
            returnKeyType="done"
            accessibilityLabel="新しいタグを入力"
          />
          <Pressable
            testID="tag-add-button"
            onPress={handleAddTag}
            disabled={!newTagText.trim()}
            accessibilityRole="button"
            accessibilityLabel="タグを追加"
            className={`p-2 rounded-lg border ${
              newTagText.trim()
                ? "bg-primary border-primary"
                : "bg-surface border-border opacity-50"
            }`}
          >
            <Plus size={ICON_SIZE + 2} color={newTagText.trim() ? "#ffffff" : ICON_COLOR_MUTED} />
          </Pressable>
        </View>
      )}

      {isAtLimit && (
        <Text testID="tag-limit-message" className="text-xs text-warning">
          {`タグは最大${maxTags}個まで選択できます`}
        </Text>
      )}
    </View>
  );
}
