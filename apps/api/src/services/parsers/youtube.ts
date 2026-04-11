import { z } from "zod";

import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, createExcerpt, TECHCLIP_USER_AGENT } from "./_shared";

/** YouTube oEmbed API エンドポイント */
const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";

/** 字幕なしを示すエラーコード（呼び出し側で 422 にマップする） */
const NO_CAPTIONS_ERROR_CODE = "NO_CAPTIONS";

/** ソース識別子 */
const SOURCE_IDENTIFIER = "youtube";

/** fetch タイムアウト（ミリ秒） */
const FETCH_TIMEOUT_MS = 10000;

/** YouTube ホスト名（標準ドメイン） */
const YOUTUBE_HOSTNAMES = ["www.youtube.com", "youtube.com", "m.youtube.com"];

/** YouTube 短縮ホスト名 */
const YOUTU_BE_HOSTNAME = "youtu.be";

/** 字幕 API として許可するホスト名 */
const CAPTION_ALLOWED_HOSTNAMES = ["www.youtube.com", "youtube.com"];

/** 動画ページ HTML のサイズ上限（バイト）。ReDoS 対策のため制限する */
const VIDEO_PAGE_HTML_MAX_BYTES = 5 * 1024 * 1024;

/** ytInitialPlayerResponse JSON の文字数上限。JSON.parse サイズ制限 */
const PLAYER_RESPONSE_JSON_MAX_LENGTH = 500 * 1024;

/** ytInitialPlayerResponse 検索範囲（バイト）。バックトラッキング対策のため切り出し範囲を制限する */
const PLAYER_RESPONSE_SEARCH_RANGE = 500_000;

/** 字幕 XML の最大サイズ（バイト）。過大レスポンス対策 */
const CAPTION_XML_MAX_BYTES = 1_000_000;

/** 字幕エントリの最大件数。過大 XML 対策 */
const CAPTION_ENTRIES_MAX = 10_000;

/** 動画 ID 抽出用パターン（11文字の英数字・ハイフン・アンダースコア） */
const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/** 字幕 XML 内の text タグを抽出する正規表現 */
const CAPTION_TEXT_REGEX = /<text[^>]*>([\s\S]*?)<\/text>/g;

/** HTML named entity マップ（字幕 XML 内に出現するもの） */
const NAMED_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

/**
 * oEmbed API レスポンスの Zod スキーマ
 */
const OEmbedResponseSchema = z.object({
  title: z.string(),
  author_name: z.string(),
  author_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

/** oEmbed API レスポンス */
type OEmbedResponse = z.infer<typeof OEmbedResponseSchema>;

/** 字幕トラック情報 */
type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
};

/** ytInitialPlayerResponse の必要部分の型 */
type PlayerResponse = {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
};

/**
 * URL から YouTube 動画 ID を抽出する
 *
 * youtube.com の watch / shorts、youtu.be の短縮 URL に対応する。
 *
 * @param url - YouTube の動画 URL
 * @returns 11文字の動画 ID
 * @throws Error - YouTube 以外の URL、または動画 ID を抽出できない場合
 */
export function extractYouTubeVideoId(url: string): string {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === YOUTU_BE_HOSTNAME) {
    const id = parsed.pathname.slice(1).split("/")[0];
    if (!VIDEO_ID_REGEX.test(id)) {
      throw new Error("YouTube動画IDを抽出できません");
    }
    return id;
  }

  if (!YOUTUBE_HOSTNAMES.includes(hostname)) {
    throw new Error("YouTubeのURLではありません");
  }

  if (parsed.pathname === "/watch") {
    const id = parsed.searchParams.get("v");
    if (!id || !VIDEO_ID_REGEX.test(id)) {
      throw new Error("YouTube動画IDを抽出できません");
    }
    return id;
  }

  if (parsed.pathname.startsWith("/shorts/")) {
    const id = parsed.pathname.replace("/shorts/", "").split("/")[0];
    if (!VIDEO_ID_REGEX.test(id)) {
      throw new Error("YouTube動画IDを抽出できません");
    }
    return id;
  }

  throw new Error("YouTube動画IDを抽出できません");
}

/**
 * 標準化された動画ページ URL を生成する
 *
 * @param videoId - 動画 ID
 * @returns watch ページの URL
 */
function buildWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * oEmbed API から動画情報を取得する
 *
 * @param videoUrl - 動画 URL
 * @returns oEmbed レスポンス
 * @throws Error - API 失敗、またはレスポンスが不正な場合
 */
async function fetchOEmbed(videoUrl: string): Promise<OEmbedResponse> {
  const oembedUrl = `${OEMBED_ENDPOINT}?url=${encodeURIComponent(videoUrl)}&format=json`;
  const response = await fetch(oembedUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`YouTube動画情報の取得に失敗しました（ステータス: ${response.status}）`);
  }

  const raw: unknown = await response.json();
  const parsed = OEmbedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("YouTube動画情報のレスポンス形式が不正です");
  }
  return parsed.data;
}

/**
 * 動画ページの HTML を取得する
 *
 * @param videoUrl - 動画 URL
 * @returns 動画ページの HTML 文字列
 * @throws Error - 取得失敗時
 */
async function fetchVideoPageHtml(videoUrl: string): Promise<string> {
  const response = await fetch(videoUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent": TECHCLIP_USER_AGENT,
      "Accept-Language": "ja,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube動画ページの取得に失敗しました（ステータス: ${response.status}）`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > VIDEO_PAGE_HTML_MAX_BYTES) {
    throw new Error("YouTube動画ページのレスポンスサイズが上限を超えています");
  }

  return new TextDecoder().decode(buffer);
}

/**
 * テキスト中の指定位置以降から最初の JSON オブジェクトをブラケット深度カウントで抽出する
 *
 * ReDoS を回避するため正規表現を使わず、'{' / '}' の深度を追跡して抽出する。
 *
 * @param text - 検索対象のテキスト
 * @param startIndex - 検索開始位置
 * @returns 抽出した JSON 文字列。見つからない場合は null
 */
function extractJsonObject(text: string, startIndex: number): string | null {
  const start = text.indexOf("{", startIndex);
  if (start === -1) {
    return null;
  }
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") {
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

/**
 * 動画ページの HTML から字幕トラック一覧を抽出する
 *
 * @param html - 動画ページの HTML
 * @returns 字幕トラックの配列。存在しない場合は空配列
 */
function extractCaptionTracks(html: string): CaptionTrack[] {
  const markerIndex = html.indexOf("ytInitialPlayerResponse");
  if (markerIndex === -1) {
    return [];
  }
  const searchEnd = Math.min(html.length, markerIndex + PLAYER_RESPONSE_SEARCH_RANGE);
  const searchArea = html.slice(markerIndex, searchEnd);

  const jsonStart = searchArea.indexOf("{");
  if (jsonStart === -1) {
    return [];
  }

  const jsonStr = extractJsonObject(searchArea, jsonStart);
  if (!jsonStr) {
    return [];
  }

  if (jsonStr.length > PLAYER_RESPONSE_JSON_MAX_LENGTH) {
    return [];
  }

  let parsed: PlayerResponse;
  try {
    parsed = JSON.parse(jsonStr) as PlayerResponse;
  } catch {
    return [];
  }

  const tracks = parsed.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(tracks)) {
    return [];
  }
  return tracks;
}

/**
 * 字幕トラックの中から優先度の高いものを 1 件選ぶ
 *
 * 日本語 → 英語 → 自動生成以外 → 先頭 の順で優先する。
 *
 * @param tracks - 字幕トラック配列（少なくとも 1 件以上であること）
 * @returns 選択された字幕トラック
 */
function selectCaptionTrack(tracks: readonly [CaptionTrack, ...CaptionTrack[]]): CaptionTrack {
  const japanese = tracks.find((track) => track.languageCode === "ja");
  if (japanese) {
    return japanese;
  }
  const english = tracks.find((track) => track.languageCode === "en");
  if (english) {
    return english;
  }
  const manual = tracks.find((track) => track.kind !== "asr");
  if (manual) {
    return manual;
  }
  return tracks[0];
}

/**
 * 字幕 XML をプレーンテキストに変換する
 *
 * @param xml - timedtext API が返す XML
 * @returns 結合済みのテキスト
 */
function parseCaptionXml(xml: string): string {
  const lines: string[] = [];
  let count = 0;
  for (const match of xml.matchAll(CAPTION_TEXT_REGEX)) {
    if (count >= CAPTION_ENTRIES_MAX) {
      break;
    }
    const text = decodeXmlEntities(match[1]).trim();
    if (text.length > 0) {
      lines.push(text);
    }
    count++;
  }
  return lines.join("\n");
}

/**
 * XML で禁止されている制御文字か判定する
 *
 * 対象: U+0000-U+0008, U+000B-U+000C, U+000E-U+001F
 *
 * @param code - 文字コードポイント
 * @returns 制御文字であれば true
 */
function isXmlForbiddenControlChar(code: number): boolean {
  return (
    (code >= 0x00 && code <= 0x08) ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f)
  );
}

/**
 * 文字列から XML 禁止制御文字を除去する
 *
 * @param text - 入力テキスト
 * @returns 制御文字を除去したテキスト
 */
function stripXmlForbiddenControlChars(text: string): string {
  let result = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (!isXmlForbiddenControlChar(code)) {
      result += char;
    }
  }
  return result;
}

/**
 * XML エンティティをデコードする
 *
 * @param text - エンコード済みテキスト
 * @returns デコード済みテキスト
 */
function decodeXmlEntities(text: string): string {
  return stripXmlForbiddenControlChars(
    text
      .replace(/&#x([\da-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
      .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITY_MAP[name] ?? match),
  );
}

/**
 * 字幕 API の URL が許可されたホスト名か検証する
 *
 * @param baseUrl - 字幕 API の baseUrl
 * @throws Error - 許可されていないホスト名の場合（SSRF 対策）
 */
function validateCaptionBaseUrl(baseUrl: string): void {
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    throw new Error("字幕URLの形式が不正です");
  }
  if (!CAPTION_ALLOWED_HOSTNAMES.includes(hostname)) {
    throw new Error("字幕URLのホスト名が許可されていません");
  }
}

/**
 * 字幕 URL から字幕本文を取得する
 *
 * @param baseUrl - 字幕 API の baseUrl
 * @returns 字幕テキスト
 * @throws Error - 取得失敗、または字幕が空の場合
 */
async function fetchCaptionText(baseUrl: string): Promise<string> {
  validateCaptionBaseUrl(baseUrl);

  const response = await fetch(baseUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(NO_CAPTIONS_ERROR_CODE);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > CAPTION_XML_MAX_BYTES) {
    throw new Error("字幕XMLのサイズが上限を超えています");
  }
  const xml = new TextDecoder().decode(buffer);
  const text = parseCaptionXml(xml);
  if (text.length === 0) {
    throw new Error(NO_CAPTIONS_ERROR_CODE);
  }
  return text;
}

/**
 * YouTube 動画ページから字幕本文を取得する
 *
 * @param videoUrl - 動画 URL
 * @returns 字幕テキスト
 * @throws Error - 字幕が見つからない場合は NO_CAPTIONS
 */
async function fetchCaptions(videoUrl: string): Promise<string> {
  const html = await fetchVideoPageHtml(videoUrl);
  const tracks = extractCaptionTracks(html);
  if (tracks.length === 0) {
    throw new Error(NO_CAPTIONS_ERROR_CODE);
  }
  const nonEmptyTracks = tracks as [CaptionTrack, ...CaptionTrack[]];
  const track = selectCaptionTrack(nonEmptyTracks);
  return fetchCaptionText(track.baseUrl);
}

/**
 * YouTube 動画 URL をパースする
 *
 * oEmbed でメタ情報を取得し、動画ページから字幕トラックを抽出する。
 * 字幕がない場合は NO_CAPTIONS エラーを投げる（呼び出し側で 422 を返す）。
 *
 * @param url - YouTube 動画 URL
 * @returns パース済み記事情報
 * @throws Error - YouTube 以外の URL、字幕なし、API 失敗時
 */
export async function parseYouTube(url: string): Promise<ParsedArticle> {
  const videoId = extractYouTubeVideoId(url);
  const watchUrl = buildWatchUrl(videoId);

  const oembed = await fetchOEmbed(watchUrl);
  const captionText = await fetchCaptions(watchUrl);

  const excerpt = createExcerpt(captionText);

  return {
    title: oembed.title,
    author: oembed.author_name,
    content: captionText,
    excerpt,
    thumbnailUrl: oembed.thumbnail_url ?? null,
    readingTimeMinutes: calculateReadingTime(captionText),
    publishedAt: null,
    source: SOURCE_IDENTIFIER,
  };
}
