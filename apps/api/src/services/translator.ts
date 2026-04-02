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

export async function createTranslationJob(
  options: TranslateOptions,
): Promise<TranslationJobResult> {
  const { title, content, targetLanguage, runpodApiKey, runpodEndpointId } = options;
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
        max_tokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`RunPod APIリクエストに失敗しました（ステータス: ${response.status}）`);
  }

  const data = (await response.json()) as { id?: string };

  if (!data.id) {
    throw new Error("RunPod job create error");
  }

  return {
    providerJobId: data.id,
    model: MODEL_NAME,
  };
}

export async function getTranslationJobStatus(params: {
  providerJobId: string;
  content: string;
  runpodApiKey: string;
  runpodEndpointId: string;
}): Promise<TranslationJobStatus> {
  const { providerJobId, content, runpodApiKey, runpodEndpointId } = params;
  const url = `${RUNPOD_API_BASE}/${runpodEndpointId}/status/${providerJobId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${runpodApiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`RunPod status error: ${response.status}`);
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
      model: MODEL_NAME,
      translatedTitle: parsed.translatedTitle,
      translatedContent: restoreCodeBlocks(parsed.translatedContent, blocks),
    };
  }

  if (data.status === "FAILED" || data.status === "CANCELLED" || data.status === "TIMED_OUT") {
    return {
      status: "failed",
      model: MODEL_NAME,
      error: data.error ?? "RunPod job failed",
    };
  }

  return {
    status: data.status === "IN_QUEUE" ? "queued" : "running",
    model: MODEL_NAME,
  };
}

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
