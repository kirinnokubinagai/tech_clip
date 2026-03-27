/** RunPod API ベースURL */
const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

/** 使用するモデル名 */
const MODEL_NAME = "qwen3.5-9b";

/** コードブロックのプレースホルダーパターン */
const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;

/** コードブロックプレースホルダーのプレフィックス */
const CODE_BLOCK_PLACEHOLDER_PREFIX = "{{CODE_BLOCK_";

/** コードブロックプレースホルダーのサフィックス */
const CODE_BLOCK_PLACEHOLDER_SUFFIX = "}}";

/** ターゲット言語の表示名マッピング */
const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
};

/** 翻訳オプション */
export type TranslateOptions = {
  title: string;
  content: string;
  targetLanguage: string;
  runpodApiKey: string;
  runpodEndpointId: string;
};

/** 翻訳結果 */
export type TranslationResult = {
  translatedTitle: string;
  translatedContent: string;
  model: string;
};

/** コードブロック抽出結果 */
type CodeBlockExtractionResult = {
  text: string;
  blocks: string[];
};

/**
 * テキストからコードブロックを抽出し、プレースホルダーに置換する
 *
 * @param text - 元のテキスト
 * @returns プレースホルダー置換済みテキストと抽出されたコードブロック
 */
export function extractCodeBlocks(text: string): CodeBlockExtractionResult {
  const blocks: string[] = [];
  const replacedText = text.replace(CODE_BLOCK_REGEX, (match) => {
    const index = blocks.length;
    blocks.push(match);
    return `${CODE_BLOCK_PLACEHOLDER_PREFIX}${index}${CODE_BLOCK_PLACEHOLDER_SUFFIX}`;
  });

  return { text: replacedText, blocks };
}

/**
 * プレースホルダーを元のコードブロックに復元する
 *
 * @param text - プレースホルダーを含むテキスト
 * @param blocks - 元のコードブロック配列
 * @returns コードブロックが復元されたテキスト
 */
export function restoreCodeBlocks(text: string, blocks: string[]): string {
  let result = text;
  for (let i = 0; i < blocks.length; i++) {
    const placeholder = `${CODE_BLOCK_PLACEHOLDER_PREFIX}${i}${CODE_BLOCK_PLACEHOLDER_SUFFIX}`;
    result = result.replace(placeholder, blocks[i]);
  }
  return result;
}

/**
 * 翻訳用プロンプトを構築する
 *
 * @param text - 翻訳対象テキスト
 * @param targetLanguage - ターゲット言語コード
 * @returns LLM向けプロンプト文字列
 */
export function buildPrompt(text: string, targetLanguage: string): string {
  const languageName = LANGUAGE_DISPLAY_NAMES[targetLanguage] ?? targetLanguage;

  return `Translate the following text to ${languageName}.
Rules:
- Preserve all markdown formatting
- Do NOT translate code blocks or placeholders like {{CODE_BLOCK_N}}
- Keep technical terms in their original form with the translation in parentheses when appropriate
- Output ONLY the translated text, no explanations

Text to translate:
${text}`;
}

/**
 * RunPod APIレスポンスから翻訳テキストを抽出する
 *
 * @param response - RunPod APIのレスポンスオブジェクト
 * @returns 抽出された翻訳テキスト
 * @throws Error - レスポンス形式が不正な場合
 */
export function parseTranslationResponse(response: unknown): string {
  const resp = response as Record<string, unknown>;
  const output = resp?.output as Record<string, unknown> | undefined;
  const choices = output?.choices as Array<Record<string, unknown>> | undefined;

  if (!choices || choices.length === 0) {
    throw new Error("翻訳レスポンスの解析に失敗しました");
  }

  const message = choices[0].message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (typeof content !== "string") {
    throw new Error("翻訳レスポンスの解析に失敗しました");
  }

  return content;
}

/**
 * RunPod API経由でテキストを翻訳する
 *
 * @param text - 翻訳対象テキスト
 * @param targetLanguage - ターゲット言語コード
 * @param apiKey - RunPod APIキー
 * @param endpointId - RunPodエンドポイントID
 * @returns 翻訳されたテキスト
 */
async function callRunPodTranslation(
  text: string,
  targetLanguage: string,
  apiKey: string,
  endpointId: string,
): Promise<string> {
  const prompt = buildPrompt(text, targetLanguage);
  const url = `${RUNPOD_API_BASE}/${endpointId}/runsync`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`RunPod APIリクエストに失敗しました（ステータス: ${response.status}）`);
  }

  const data = await response.json();
  return parseTranslationResponse(data);
}

/**
 * 記事を翻訳する
 *
 * コードブロックを保護しつつ、タイトルとコンテンツを翻訳する。
 * RunPod上のQwen3.5 9Bモデルを使用。
 *
 * @param options - 翻訳オプション
 * @returns 翻訳結果（タイトル、コンテンツ、使用モデル）
 * @throws Error - API通信エラーまたは翻訳処理エラー時
 */
export async function translateArticle(options: TranslateOptions): Promise<TranslationResult> {
  const { title, content, targetLanguage, runpodApiKey, runpodEndpointId } = options;

  try {
    const { text: textWithoutCode, blocks } = extractCodeBlocks(content);

    const [translatedTitle, translatedContentRaw] = await Promise.all([
      callRunPodTranslation(title, targetLanguage, runpodApiKey, runpodEndpointId),
      callRunPodTranslation(textWithoutCode, targetLanguage, runpodApiKey, runpodEndpointId),
    ]);

    const translatedContent = restoreCodeBlocks(translatedContentRaw, blocks);

    return {
      translatedTitle,
      translatedContent,
      model: MODEL_NAME,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("RunPod API")) {
      throw error;
    }
    throw new Error("翻訳処理に失敗しました");
  }
}
