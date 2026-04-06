import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { apiFetch } from "@/lib/api";

/** SecureStoreキー: 言語設定 */
const LANGUAGE_KEY = "settings_language";

/** SecureStoreキー: 要約言語設定 */
const SUMMARY_LANGUAGE_KEY = "settings_summary_language";

/** サポートするlocaleコード */
const LOCALE_CODES = ["ja", "en"] as const;

/** localeコードの型 */
export type Language = (typeof LOCALE_CODES)[number];

/** デフォルト言語 */
const DEFAULT_LANGUAGE: Language = "ja";

/**
 * localeコードから表示名へのマッピング
 * 現時点では ja/en のみ対応のため恒等写像に近いが、
 * 将来 zh/ko など非対称マッピングが必要になる可能性を考慮して維持する
 */
export const LANGUAGE_LABEL_MAP: Record<Language, string> = {
  ja: "日本語",
  en: "English",
};

/** 旧形式表示名からlocaleコードへの移行マッピング */
const LEGACY_LANGUAGE_MIGRATION_MAP: Record<string, Language> = {
  日本語: "ja",
  English: "en",
};

/**
 * 保存値をLocale codeに正規化する
 * 旧形式（表示名）が保存されている場合はlocaleコードに変換する
 *
 * @param stored - SecureStoreから取得したJSON文字列値
 * @returns 正規化されたlocaleコードと移行が必要かどうかのフラグ
 */
function normalizeStoredLanguage(stored: string): {
  language: Language;
  needsMigration: boolean;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return { language: DEFAULT_LANGUAGE, needsMigration: true };
  }
  if (typeof parsed !== "string") {
    return { language: DEFAULT_LANGUAGE, needsMigration: true };
  }

  if ((LOCALE_CODES as ReadonlyArray<string>).includes(parsed)) {
    return { language: parsed as Language, needsMigration: false };
  }

  const migrated = LEGACY_LANGUAGE_MIGRATION_MAP[parsed];
  return { language: migrated ?? DEFAULT_LANGUAGE, needsMigration: true };
}

/** 要約言語コード選択肢 */
const SUMMARY_LANGUAGE_OPTIONS = ["ja", "en", "zh", "ko"] as const;

/** 要約言語コードの型 */
export type SummaryLanguage = (typeof SUMMARY_LANGUAGE_OPTIONS)[number];

/** 要約言語コードと表示名のマップ */
export const SUMMARY_LANGUAGE_LABELS: Record<SummaryLanguage, string> = {
  ja: "日本語",
  en: "English",
  zh: "中文",
  ko: "한국어",
} as const;

/** デフォルト要約言語 */
const DEFAULT_SUMMARY_LANGUAGE: SummaryLanguage = "ja";

/**
 * 値がサポートされている要約言語コードかどうかを判定する
 *
 * @param value - チェックする値
 * @returns サポートされている要約言語コードであればtrue
 */
function isSupportedSummaryLanguage(value: string): value is SummaryLanguage {
  return (SUMMARY_LANGUAGE_OPTIONS as readonly string[]).includes(value);
}

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
  if (!isSupportedSummaryLanguage(deviceLang)) {
    return DEFAULT_SUMMARY_LANGUAGE;
  }
  return deviceLang;
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
  /** 表示言語（localeコード） */
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
  language: DEFAULT_LANGUAGE,
  isLanguageLoaded: false,
  summaryLanguage: DEFAULT_SUMMARY_LANGUAGE,
  isSummaryLanguageLoaded: false,
  notificationSettings: null,
  isNotificationSettingsLoaded: false,

  /**
   * SecureStoreから言語設定を読み込む
   * 旧形式の表示名が保存されている場合はlocaleコードに移行する
   * アプリ起動時に呼び出す
   */
  loadLanguage: async () => {
    const stored = await SecureStore.getItemAsync(LANGUAGE_KEY);
    if (stored === null) {
      set({ language: DEFAULT_LANGUAGE, isLanguageLoaded: true });
      return;
    }
    const { language, needsMigration } = normalizeStoredLanguage(stored);
    if (needsMigration) {
      await SecureStore.setItemAsync(LANGUAGE_KEY, JSON.stringify(language));
    }
    set({ language, isLanguageLoaded: true });
  },

  /**
   * 言語設定を変更してSecureStoreに永続化する
   *
   * @param language - 設定するlocaleコード
   */
  setLanguage: async (language: Language) => {
    await SecureStore.setItemAsync(LANGUAGE_KEY, JSON.stringify(language));
    set({ language });
  },

  /**
   * SecureStoreから要約言語設定を読み込む
   * アプリ起動時に呼び出す。保存がない場合はデバイス言語を使用する。
   * パース失敗時や不正値の場合はデバイス言語にフォールバックし、SecureStoreを修復する
   */
  loadSummaryLanguage: async () => {
    const stored = await SecureStore.getItemAsync(SUMMARY_LANGUAGE_KEY);
    if (stored === null) {
      set({ summaryLanguage: resolveDeviceSummaryLanguage(), isSummaryLanguageLoaded: true });
      return;
    }
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (typeof parsed === "string" && isSupportedSummaryLanguage(parsed)) {
        set({ summaryLanguage: parsed, isSummaryLanguageLoaded: true });
        return;
      }
    } catch {
      // fall through
    }
    const fallback = resolveDeviceSummaryLanguage();
    await SecureStore.setItemAsync(SUMMARY_LANGUAGE_KEY, JSON.stringify(fallback));
    set({ summaryLanguage: fallback, isSummaryLanguageLoaded: true });
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
