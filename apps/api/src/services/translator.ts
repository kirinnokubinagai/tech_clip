import { DEFAULT_GEMMA_MODEL_TAG } from "../lib/ai-model";

/** RunPod API ベースURL */
const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

/** 翻訳時の最大トークン数 */
const MAX_TRANSLATION_TOKENS = 4096;

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
  /** データベース保存用のモデルタグ（省略時は DEFAULT_GEMMA_MODEL_TAG を使用） */
  modelTag?: string;
};

/** 翻訳結果 */
export type TranslationResult = {
  translatedTitle: string;
  translatedContent: string;
  model: string;
};

export type TranslationJobResult = {
  providerJobId: string;
  model: string;
};

export type TranslationJobStatus =
  | { status: "queued" | "running"; model: string }
  | { status: "completed"; model: string; translatedTitle: string; translatedContent: string }
  | { status: "failed"; model: string; error: string };

/** コードブロック抽出結果 */
type CodeBlockExtractionResult = {
  text: string;
  blocks: string[];
};

export function extractCodeBlocks(text: string): CodeBlockExtractionResult {
  const blocks: string[] = [];
  const replacedText = text.replace(CODE_BLOCK_REGEX, (match) => {
    const index = blocks.length;
    blocks.push(match);
    return `${CODE_BLOCK_PLACEHOLDER_PREFIX}${index}${CODE_BLOCK_PLACEHOLDER_SUFFIX}`;
  });

  return { text: replacedText, blocks };
}

export function restoreCodeBlocks(text: string, blocks: string[]): string {
  let result = text;
  for (let i = 0; i < blocks.length; i++) {
    const placeholder = `${CODE_BLOCK_PLACEHOLDER_PREFIX}${i}${CODE_BLOCK_PLACEHOLDER_SUFFIX}`;
    result = result.replace(placeholder, blocks[i]);
  }
  return result;
}

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

function buildArticleTranslationPrompt(
  title: string,
  content: string,
  targetLanguage: string,
): string {
  const languageName = LANGUAGE_DISPLAY_NAMES[targetLanguage] ?? targetLanguage;

  return `Translate the following article to ${languageName}.
Rules:
- Preserve all markdown formatting in content
- Do NOT translate code blocks or placeholders like {{CODE_BLOCK_N}}
- Keep technical terms in their original form with the translation in parentheses when appropriate
- Return ONLY valid JSON
- JSON format: {"translatedTitle":"...","translatedContent":"..."}

Title:
${title}

Content:
${content}`;
}

/** RunPod翻訳レスポンスの期待する構造 */
type RunPodTranslationOutput = {
  output: {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  };
};

/**
 * RunPod翻訳レスポンスの型ガード
 *
 * @param value - 検証対象の値
 * @returns RunPodTranslationOutput型かどうか
 */
function isRunPodTranslationOutput(value: unknown): value is RunPodTranslationOutput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.output !== "object" || v.output === null) return false;
  const output = v.output as Record<string, unknown>;
  if (!Array.isArray(output.choices) || output.choices.length === 0) return false;
  const first = output.choices[0] as Record<string, unknown> | undefined;
  if (typeof first?.message !== "object" || first.message === null) return false;
  const message = first.message as Record<string, unknown>;
  return typeof message.content === "string";
}

export function parseTranslationResponse(response: unknown): string {
  if (!isRunPodTranslationOutput(response)) {
    throw new Error("翻訳レスポンスの解析に失敗しました");
  }

  return response.output.choices[0].message.content;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return trimmed;
}

function parseArticleTranslationPayload(text: string): {
  translatedTitle: string;
  translatedContent: string;
} {
  const parsed = JSON.parse(extractJsonObject(text)) as {
    translatedTitle?: string;
    translatedContent?: string;
  };

  if (typeof parsed.translatedTitle !== "string" || typeof parsed.translatedContent !== "string") {
    throw new Error("翻訳レスポンスの解析に失敗しました");
  }

  return {
    translatedTitle: parsed.translatedTitle,
    translatedContent: parsed.translatedContent,
  };
}

/**
 * 使用するモデルタグを解決する
 *
 * @param modelTag - 任意のモデルタグ
 * @returns 未指定の場合は DEFAULT_GEMMA_MODEL_TAG
 */
function resolveModelTag(modelTag: string | undefined): string {
  return modelTag ?? DEFAULT_GEMMA_MODEL_TAG;
}

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
        max_tokens: MAX_TRANSLATION_TOKENS,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`RunPod APIリクエストに失敗しました（ステータス: ${response.status}）`);
  }

  const data = await response.json();
  return parseTranslationResponse(data);
}

export async function createTranslationJob(
  options: TranslateOptions,
): Promise<TranslationJobResult> {
  const { title, content, targetLanguage, runpodApiKey, runpodEndpointId, modelTag } = options;
  const { text: textWithoutCode } = extractCodeBlocks(content);
  const prompt = buildArticleTranslationPrompt(title, textWithoutCode, targetLanguage);
  const url = `${RUNPOD_API_BASE}/${runpodEndpointId}/run`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runpodApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_TRANSLATION_TOKENS,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`RunPod APIリクエストに失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as { id?: string };

  if (!data.id) {
    throw new Error("RunPodジョブの作成に失敗しました");
  }

  return {
    providerJobId: data.id,
    model: resolveModelTag(modelTag),
  };
}

export async function getTranslationJobStatus(params: {
  providerJobId: string;
  content: string;
  runpodApiKey: string;
  runpodEndpointId: string;
  modelTag?: string;
}): Promise<TranslationJobStatus> {
  const { providerJobId, content, runpodApiKey, runpodEndpointId, modelTag } = params;
  const url = `${RUNPOD_API_BASE}/${runpodEndpointId}/status/${providerJobId}`;
  const resolvedTag = resolveModelTag(modelTag);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${runpodApiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`RunPodステータス取得に失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as {
    status: string;
    error?: string;
    output?: {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
  };

  if (data.status === "COMPLETED") {
    const contentText = parseTranslationResponse(data);
    const parsed = parseArticleTranslationPayload(contentText);
    const { blocks } = extractCodeBlocks(content);

    return {
      status: "completed",
      model: resolvedTag,
      translatedTitle: parsed.translatedTitle,
      translatedContent: restoreCodeBlocks(parsed.translatedContent, blocks),
    };
  }

  if (data.status === "FAILED" || data.status === "CANCELLED" || data.status === "TIMED_OUT") {
    return {
      status: "failed",
      model: resolvedTag,
      error: data.error ?? "RunPodジョブの実行に失敗しました",
    };
  }

  return {
    status: data.status === "IN_QUEUE" ? "queued" : "running",
    model: resolvedTag,
  };
}

export async function translateArticle(options: TranslateOptions): Promise<TranslationResult> {
  const { title, content, targetLanguage, runpodApiKey, runpodEndpointId, modelTag } = options;

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
      model: resolveModelTag(modelTag),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("RunPod API")) {
      throw error;
    }
    throw new Error("翻訳処理に失敗しました");
  }
}
