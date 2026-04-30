import { parseHTML } from "linkedom";

import { safeFetch } from "../../lib/safe-fetch";
import type { ParsedArticle } from "../../types/article";
import { calculateReadingTime, TECHCLIP_USER_AGENT } from "./_shared";

/** Speakerdeckのホスト名 */
const SPEAKERDECK_HOSTNAME = "speakerdeck.com";

/**
 * linkedomのドキュメント型
 *
 * Cloudflare Workers環境にはDOM型が存在しないため、
 * linkedomが返すドキュメントオブジェクトの必要なインターフェースのみ定義する
 */
type LinkedomDocument = {
  querySelector: (
    selector: string,
  ) => { getAttribute: (name: string) => string | null; textContent: string | null } | null;
};

/**
 * HTMLからOGPメタタグのcontent値を取得する
 *
 * @param doc - linkedomのドキュメントオブジェクト
 * @param property - metaタグのproperty属性値
 * @returns メタタグのcontent値。存在しない場合はnull
 */
function getMetaContent(doc: LinkedomDocument, property: string): string | null {
  const meta = doc.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    return null;
  }
  return meta.getAttribute("content");
}

/**
 * HTMLからname属性のメタタグのcontent値を取得する
 *
 * @param doc - linkedomのドキュメントオブジェクト
 * @param name - metaタグのname属性値
 * @returns メタタグのcontent値。存在しない場合はnull
 */
function getMetaNameContent(doc: LinkedomDocument, name: string): string | null {
  const meta = doc.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    return null;
  }
  return meta.getAttribute("content");
}

/**
 * URLがSpeakerdeckのものか検証する
 *
 * @param url - 検証対象のURL
 * @throws Error - Speakerdeck以外のURLの場合
 */
function validateSpeakerdeckUrl(url: string): void {
  const parsed = new URL(url);

  if (parsed.hostname !== SPEAKERDECK_HOSTNAME) {
    throw new Error("SpeakerdeckのURLではありません");
  }
}

/**
 * SpeakerdeckのURLからHTML取得し、OGPメタタグからスライド情報を抽出する
 *
 * スライド本文はiframeで埋め込まれるため直接抽出できない。
 * OGPメタタグからタイトル、著者、概要、サムネイルを取得する。
 *
 * @param url - SpeakerdeckスライドのURL（例: https://speakerdeck.com/user/slide-name）
 * @returns パースされた記事情報
 * @throws Error - URLの検証、HTML取得、またはパースに失敗した場合
 */
export async function parseSpeakerdeck(url: string): Promise<ParsedArticle> {
  validateSpeakerdeckUrl(url);

  const response = await safeFetch(url, {
    headers: { "User-Agent": TECHCLIP_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Speakerdeckページの取得に失敗しました（ステータス: ${response.status}）`);
  }

  const html = await response.text();
  const { document } = parseHTML(html);
  const doc = document as unknown as LinkedomDocument;

  const title = getMetaContent(doc, "og:title");

  if (!title) {
    throw new Error("スライドのタイトルを取得できません");
  }

  const description = getMetaContent(doc, "og:description");
  const thumbnailUrl = getMetaContent(doc, "og:image");
  const author = getMetaNameContent(doc, "author");
  const publishedAt = getMetaContent(doc, "article:published_time");

  const content = description ?? "";

  return {
    title,
    author,
    content,
    excerpt: description,
    thumbnailUrl,
    readingTimeMinutes: calculateReadingTime(content),
    publishedAt,
    source: SPEAKERDECK_HOSTNAME,
  };
}
