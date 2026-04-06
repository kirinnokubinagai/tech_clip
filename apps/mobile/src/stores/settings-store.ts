import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { apiFetch } from "@/lib/api";

/** SecureStoreキー: 言語設定 */
const LANGUAGE_KEY = "settings_language";

/** 言語ロケールコード */
const LOCALE_CODES = ["ja", "en"] as const;

/** 言語の型（ロケールコード） */
export type Language = (typeof LOCALE_CODES)[number];

/** デフォルト言語 */
const DEFAULT_LANGUAGE: Language = "ja";

/** 言語ラベルマップ */
export const LANGUAGE_LABEL_MAP: Record<Language, string> = {
  ja: "日本語",
  en: "English",
};

/** 旧表示名からロケールコードへの変換マップ */
const LEGACY_LANGUAGE_MIGRATION_MAP: Record<string, Language> = {
  日本語: "ja",
  English: "en",
};

/**
 * 保存済み言語設定をロケールコードに正規化する
 *
 * @param stored - SecureStoreから取得した文字列
 * @returns 正規化された言語とマイグレーション要否
 */
function normalizeStoredLanguage(stored: string): { language: Language; needsMigration: boolean } {
  if ((LOCALE_CODES as readonly string[]).includes(stored)) {
    return { language: stored as Language, needsMigration: false };
  }
  const migrated = LEGACY_LANGUAGE_MIGRATION_MAP[stored];
  if (migrated !== undefined) {
    return { language: migrated, needsMigration: true };
  }
  return { language: DEFAULT_LANGUAGE, needsMigration: false };
}

/** 通知設定の型 */
export type NotificationSettings = {
  id: string;
  newArticle: boolean;
  aiComplete: boolean;
  follow: boolean;
  system: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 通知設定APIレスポンスの型 */
type NotificationSettingsResponse = {
  success: true;
  data: NotificationSettings;
};

type SettingsStore = {
  /** 表示言語 */
  language: Language;
  /** 言語設定の読み込み完了フラグ */
  isLanguageLoaded: boolean;
  /** 通知設定 */
  notificationSettings: NotificationSettings | null;
  /** 通知設定の読み込み完了フラグ */
  isNotificationSettingsLoaded: boolean;
  /** SecureStoreから言語設定を読み込む */
  loadLanguage: () => Promise<void>;
  /** 言語設定を変更してSecureStoreに永続化する */
  setLanguage: (language: Language) => Promise<void>;
  /** APIから通知設定を取得する */
  fetchNotificationSettings: () => Promise<void>;
  /** 全通知のON/OFFをAPIに保存する */
  updateNotificationEnabled: (enabled: boolean) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  language: DEFAULT_LANGUAGE,
  isLanguageLoaded: false,
  notificationSettings: null,
  isNotificationSettingsLoaded: false,

  /**
   * SecureStoreから言語設定を読み込む
   * アプリ起動時に呼び出す
   */
  loadLanguage: async () => {
    const stored = await SecureStore.getItemAsync(LANGUAGE_KEY);
    if (stored === null) {
      set({ language: DEFAULT_LANGUAGE, isLanguageLoaded: true });
      return;
    }
    const { language, needsMigration } = normalizeStoredLanguage(JSON.parse(stored) as string);
    if (needsMigration) {
      await SecureStore.setItemAsync(LANGUAGE_KEY, JSON.stringify(language));
    }
    set({ language, isLanguageLoaded: true });
  },

  /**
   * 言語設定を変更してSecureStoreに永続化する
   *
   * @param language - 設定する言語
   */
  setLanguage: async (language: Language) => {
    await SecureStore.setItemAsync(LANGUAGE_KEY, JSON.stringify(language));
    set({ language });
  },

  /**
   * APIから通知設定を取得する
   * 取得失敗時もisNotificationSettingsLoadedをtrueにする
   */
  fetchNotificationSettings: async () => {
    try {
      const data = await apiFetch<NotificationSettingsResponse>(
        "/api/users/me/notification-settings",
      );
      set({ notificationSettings: data.data, isNotificationSettingsLoaded: true });
    } catch {
      set({ isNotificationSettingsLoaded: true });
    }
  },

  /**
   * 全通知のON/OFFをAPIに保存する
   * 楽観的更新を行い、失敗時はロールバックする
   *
   * @param enabled - trueで全通知ON、falseで全通知OFF
   * @throws Error - API更新失敗時
   */
  updateNotificationEnabled: async (enabled: boolean) => {
    const previous = get().notificationSettings;

    const updatePayload = {
      newArticle: enabled,
      aiComplete: enabled,
      follow: enabled,
      system: enabled,
    };

    try {
      const data = await apiFetch<NotificationSettingsResponse>(
        "/api/users/me/notification-settings",
        {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        },
      );
      set({ notificationSettings: data.data });
    } catch {
      set({ notificationSettings: previous });
      throw new Error("通知設定の更新に失敗しました");
    }
  },
}));
