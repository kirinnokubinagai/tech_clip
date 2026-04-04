import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { apiFetch } from "@/lib/api";

/** SecureStoreキー: 言語設定 */
const LANGUAGE_KEY = "settings_language";

/** SecureStoreキー: 要約言語設定 */
const SUMMARY_LANGUAGE_KEY = "settings_summary_language";

/** 言語選択肢 */
const LANGUAGE_OPTIONS = ["日本語", "English"] as const;

/** 言語選択肢の型 */
export type Language = (typeof LANGUAGE_OPTIONS)[number];

/** 要約言語コード選択肢 */
const SUMMARY_LANGUAGE_OPTIONS = ["ja", "en", "zh", "ko"] as const;

/** 要約言語コードの型 */
export type SummaryLanguage = (typeof SUMMARY_LANGUAGE_OPTIONS)[number];

/** デフォルト要約言語 */
const DEFAULT_SUMMARY_LANGUAGE: SummaryLanguage = "ja";

/**
 * デバイスのロケールから要約言語コードを解決する
 *
 * @returns サポートされている要約言語コード
 */
function resolveDeviceSummaryLanguage(): SummaryLanguage {
  const locales = getLocales();
  if (locales.length === 0) {
    return DEFAULT_SUMMARY_LANGUAGE;
  }
  const deviceLang = locales[0]?.languageCode;
  if (!deviceLang) {
    return DEFAULT_SUMMARY_LANGUAGE;
  }
  const isSupported = SUMMARY_LANGUAGE_OPTIONS.includes(
    deviceLang as SummaryLanguage,
  );
  if (!isSupported) {
    return DEFAULT_SUMMARY_LANGUAGE;
  }
  return deviceLang as SummaryLanguage;
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
  /** 要約言語コード */
  summaryLanguage: SummaryLanguage;
  /** 要約言語設定の読み込み完了フラグ */
  isSummaryLanguageLoaded: boolean;
  /** 通知設定 */
  notificationSettings: NotificationSettings | null;
  /** 通知設定の読み込み完了フラグ */
  isNotificationSettingsLoaded: boolean;
  /** SecureStoreから言語設定を読み込む */
  loadLanguage: () => Promise<void>;
  /** 言語設定を変更してSecureStoreに永続化する */
  setLanguage: (language: Language) => Promise<void>;
  /** SecureStoreから要約言語設定を読み込む */
  loadSummaryLanguage: () => Promise<void>;
  /** 要約言語設定を変更してSecureStoreに永続化する */
  setSummaryLanguage: (language: SummaryLanguage) => Promise<void>;
  /** APIから通知設定を取得する */
  fetchNotificationSettings: () => Promise<void>;
  /** 全通知のON/OFFをAPIに保存する */
  updateNotificationEnabled: (enabled: boolean) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  language: "日本語",
  isLanguageLoaded: false,
  summaryLanguage: DEFAULT_SUMMARY_LANGUAGE,
  isSummaryLanguageLoaded: false,
  notificationSettings: null,
  isNotificationSettingsLoaded: false,

  /**
   * SecureStoreから言語設定を読み込む
   * アプリ起動時に呼び出す
   */
  loadLanguage: async () => {
    const stored = await SecureStore.getItemAsync(LANGUAGE_KEY);
    const language: Language = stored !== null ? (JSON.parse(stored) as Language) : "日本語";
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
   * SecureStoreから要約言語設定を読み込む
   * アプリ起動時に呼び出す。保存がない場合はデバイス言語を使用する
   */
  loadSummaryLanguage: async () => {
    const stored = await SecureStore.getItemAsync(SUMMARY_LANGUAGE_KEY);
    const summaryLanguage: SummaryLanguage =
      stored !== null ? (JSON.parse(stored) as SummaryLanguage) : resolveDeviceSummaryLanguage();
    set({ summaryLanguage, isSummaryLanguageLoaded: true });
  },

  /**
   * 要約言語設定を変更してSecureStoreに永続化する
   *
   * @param language - 設定する要約言語コード
   */
  setSummaryLanguage: async (language: SummaryLanguage) => {
    await SecureStore.setItemAsync(SUMMARY_LANGUAGE_KEY, JSON.stringify(language));
    set({ summaryLanguage: language });
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
