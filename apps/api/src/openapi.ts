/**
 * TechClip API OpenAPI 3.0 仕様
 *
 * すべてのエンドポイントのリクエスト・レスポンス定義を含む静的オブジェクト
 */

/** OpenAPI パスアイテムの型 */
type PathItem = Record<string, unknown>;

/** OpenAPI 仕様の型 */
type OpenApiSpec = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  security: Array<Record<string, string[]>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
    responses: Record<string, unknown>;
  };
  paths: Record<string, PathItem>;
};

/** 共通の成功レスポンス（データあり） */
const successResponse = (dataSchema: Record<string, unknown>) => ({
  description: "成功",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: dataSchema,
        },
        required: ["success", "data"],
      },
    },
  },
});

/** 共通のページネーション付き成功レスポンス */
const paginatedSuccessResponse = (itemSchema: Record<string, unknown>) => ({
  description: "成功",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "array", items: itemSchema },
          meta: {
            type: "object",
            properties: {
              nextCursor: { type: "string", nullable: true },
              hasNext: { type: "boolean" },
            },
          },
        },
        required: ["success", "data", "meta"],
      },
    },
  },
});

/** 共通エラーレスポンス参照 */
const errorRef = (ref: string) => ({ $ref: ref });

/** 認証エラーレスポンス */
const unauthorizedResponse = {
  description: "未認証",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

/** 権限エラーレスポンス */
const forbiddenResponse = {
  description: "権限なし",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

/** リソース未発見エラーレスポンス */
const notFoundResponse = {
  description: "リソースが見つかりません",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

/** バリデーションエラーレスポンス */
const validationErrorResponse = {
  description: "バリデーションエラー",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

/** サーバーエラーレスポンス */
const internalErrorResponse = {
  description: "サーバーエラー",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

/** ページネーションクエリパラメータ */
const paginationParams = [
  {
    name: "limit",
    in: "query",
    description: "取得件数（1〜50、デフォルト: 20）",
    schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
  },
  {
    name: "cursor",
    in: "query",
    description: "カーソル（次ページ取得用）",
    schema: { type: "string" },
  },
];

/** 記事スキーマ */
const articleSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "01ARZ3NDEKTSV4RRFFQ69G5FAV" },
    userId: { type: "string" },
    url: { type: "string", format: "uri" },
    source: { type: "string", example: "zenn.dev" },
    title: { type: "string" },
    author: { type: "string", nullable: true },
    excerpt: { type: "string", nullable: true },
    thumbnailUrl: { type: "string", nullable: true },
    readingTimeMinutes: { type: "integer", nullable: true },
    isRead: { type: "boolean" },
    isFavorite: { type: "boolean" },
    isPublic: { type: "boolean" },
    publishedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

/** ユーザースキーマ */
const userSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string", nullable: true },
    username: { type: "string", nullable: true },
    email: { type: "string", format: "email" },
    bio: { type: "string", nullable: true },
    avatarUrl: { type: "string", nullable: true },
    websiteUrl: { type: "string", nullable: true },
    githubUsername: { type: "string", nullable: true },
    twitterUsername: { type: "string", nullable: true },
    isProfilePublic: { type: "boolean" },
    preferredLanguage: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

/** タグスキーマ */
const tagSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    userId: { type: "string" },
    name: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
};

/** 通知スキーマ */
const notificationSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    userId: { type: "string" },
    type: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    data: { type: "string", nullable: true },
    isRead: { type: "boolean" },
    createdAt: { type: "string" },
  },
};

/** 翻訳スキーマ */
const translationSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    articleId: { type: "string" },
    targetLanguage: { type: "string", enum: ["en", "ja"] },
    translatedTitle: { type: "string" },
    translatedContent: { type: "string" },
    model: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
};

/** 要約スキーマ */
const summarySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    articleId: { type: "string" },
    language: { type: "string", enum: ["ja", "en", "zh", "ko"] },
    summary: { type: "string" },
    model: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
  },
};

/**
 * TechClip API の OpenAPI 3.0 仕様オブジェクト
 *
 * すべてのエンドポイントを静的に定義する
 */
export const openApiSpec: OpenApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "TechClip API",
    version: "1.0.0",
    description:
      "TechClip - 技術記事・動画をAIで要約・翻訳してモバイルで快適に閲覧できるキュレーションアプリのAPI",
  },
  servers: [
    { url: "https://api.techclip.app", description: "本番環境" },
    { url: "http://localhost:8787", description: "ローカル開発環境" },
  ],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Better Auth が発行するセッショントークン",
      },
    },
    schemas: {
      Article: articleSchema,
      User: userSchema,
      Tag: tagSchema,
      Notification: notificationSchema,
      Translation: translationSchema,
      Summary: summarySchema,
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "AUTH_REQUIRED" },
              message: { type: "string", example: "ログインが必要です" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    message: { type: "string" },
                  },
                },
                nullable: true,
              },
            },
            required: ["code", "message"],
          },
        },
        required: ["success", "error"],
      },
    },
    responses: {
      UnauthorizedError: {
        description: "未認証エラー",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: {
              success: false,
              error: { code: "AUTH_REQUIRED", message: "ログインが必要です" },
            },
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "ヘルスチェック",
        description: "APIサーバーの稼働状態を確認する",
        security: [],
        responses: {
          "200": {
            description: "正常稼働中",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/api/articles": {
      get: {
        tags: ["Articles"],
        summary: "記事一覧取得",
        description: "認証ユーザーの記事一覧をカーソルベースページネーションで取得する",
        parameters: [
          ...paginationParams,
          {
            name: "source",
            in: "query",
            description: "ソースドメインでフィルタ",
            schema: { type: "string" },
          },
          {
            name: "isFavorite",
            in: "query",
            description: "お気に入りフィルタ",
            schema: { type: "boolean" },
          },
          {
            name: "isRead",
            in: "query",
            description: "既読フィルタ",
            schema: { type: "boolean" },
          },
        ],
        responses: {
          "200": paginatedSuccessResponse({ $ref: "#/components/schemas/Article" }),
          "401": unauthorizedResponse,
          "422": validationErrorResponse,
        },
      },
      post: {
        tags: ["Articles"],
        summary: "記事保存",
        description: "URLを指定して記事を保存する。記事のパースと重複チェックを行う",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: {
                  url: {
                    type: "string",
                    format: "uri",
                    maxLength: 2048,
                    example: "https://zenn.dev/example/articles/sample",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": successResponse({ $ref: "#/components/schemas/Article" }),
          "401": unauthorizedResponse,
          "409": {
            description: "記事がすでに保存されています",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "422": validationErrorResponse,
          "500": internalErrorResponse,
        },
      },
    },

    "/api/articles/{id}": {
      get: {
        tags: ["Articles"],
        summary: "記事詳細取得",
        description: "指定IDの記事詳細を取得する（所有者のみ）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/Article" }),
          "401": unauthorizedResponse,
          "403": forbiddenResponse,
          "404": notFoundResponse,
        },
      },
      patch: {
        tags: ["Articles"],
        summary: "記事更新",
        description: "記事の既読・お気に入り・公開状態を更新する（所有者のみ）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  isRead: { type: "boolean" },
                  isFavorite: { type: "boolean" },
                  isPublic: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/Article" }),
          "401": unauthorizedResponse,
          "403": forbiddenResponse,
          "404": notFoundResponse,
          "422": validationErrorResponse,
        },
      },
      delete: {
        tags: ["Articles"],
        summary: "記事削除",
        description: "指定IDの記事を削除する（所有者のみ）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { description: "削除成功" },
          "401": unauthorizedResponse,
          "403": forbiddenResponse,
          "404": notFoundResponse,
        },
      },
    },

    "/api/articles/{id}/favorite": {
      post: {
        tags: ["Articles"],
        summary: "お気に入りトグル",
        description: "記事のお気に入り状態をトグルする（所有者のみ）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": successResponse({
            type: "object",
            properties: {
              id: { type: "string" },
              isFavorite: { type: "boolean" },
            },
          }),
          "401": unauthorizedResponse,
          "403": forbiddenResponse,
          "404": notFoundResponse,
        },
      },
    },

    "/api/articles/{id}/tags": {
      put: {
        tags: ["Tags"],
        summary: "記事タグ更新",
        description: "記事に付けるタグを置換方式で更新する（所有者のみ）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["tagIds"],
                properties: {
                  tagIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "タグIDの配列",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse({
            type: "object",
            properties: {
              articleId: { type: "string" },
              tagIds: { type: "array", items: { type: "string" } },
            },
          }),
          "401": unauthorizedResponse,
          "404": notFoundResponse,
          "422": validationErrorResponse,
        },
      },
    },

    "/api/articles/{id}/translate": {
      post: {
        tags: ["AI"],
        summary: "記事翻訳",
        description: "記事をAIで翻訳する。キャッシュが存在する場合はそのまま返す（所有者のみ）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["targetLanguage"],
                properties: {
                  targetLanguage: {
                    type: "string",
                    enum: ["en", "ja"],
                    description: "翻訳先言語",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/Translation" }),
          "201": successResponse({ $ref: "#/components/schemas/Translation" }),
          "401": unauthorizedResponse,
          "403": forbiddenResponse,
          "404": notFoundResponse,
          "422": validationErrorResponse,
          "500": internalErrorResponse,
        },
      },
      get: {
        tags: ["AI"],
        summary: "翻訳結果取得",
        description: "キャッシュ済みの翻訳結果を取得する（所有者のみ）",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          {
            name: "targetLanguage",
            in: "query",
            required: true,
            description: "翻訳先言語",
            schema: { type: "string", enum: ["en", "ja"] },
          },
        ],
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/Translation" }),
          "401": unauthorizedResponse,
          "403": forbiddenResponse,
          "404": notFoundResponse,
          "422": validationErrorResponse,
        },
      },
    },

    "/api/articles/{id}/summary": {
      post: {
        tags: ["AI"],
        summary: "記事要約生成",
        description: "記事をAIで要約する。キャッシュが存在する場合はそのまま返す（所有者のみ）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["language"],
                properties: {
                  language: {
                    type: "string",
                    enum: ["ja", "en", "zh", "ko"],
                    description: "要約言語",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/Summary" }),
          "201": successResponse({ $ref: "#/components/schemas/Summary" }),
          "401": unauthorizedResponse,
          "403": forbiddenResponse,
          "404": notFoundResponse,
          "422": validationErrorResponse,
          "500": internalErrorResponse,
        },
      },
      get: {
        tags: ["AI"],
        summary: "要約取得",
        description: "キャッシュ済みの要約を取得する（所有者のみ）",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          {
            name: "language",
            in: "query",
            description: "要約言語（デフォルト: ja）",
            schema: { type: "string", enum: ["ja", "en", "zh", "ko"], default: "ja" },
          },
        ],
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/Summary" }),
          "401": unauthorizedResponse,
          "403": forbiddenResponse,
          "404": notFoundResponse,
        },
      },
    },

    "/api/users/me": {
      get: {
        tags: ["Users"],
        summary: "自分のプロフィール取得",
        description: "認証ユーザー自身のプロフィール情報を取得する",
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/User" }),
          "401": unauthorizedResponse,
          "404": notFoundResponse,
        },
      },
      patch: {
        tags: ["Users"],
        summary: "プロフィール更新",
        description: "認証ユーザー自身のプロフィール情報を更新する",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", maxLength: 100, nullable: true },
                  username: {
                    type: "string",
                    maxLength: 30,
                    pattern: "^[a-zA-Z0-9_-]+$",
                    nullable: true,
                  },
                  bio: { type: "string", maxLength: 500, nullable: true },
                  websiteUrl: { type: "string", format: "uri", maxLength: 2048, nullable: true },
                  githubUsername: { type: "string", maxLength: 39, nullable: true },
                  twitterUsername: { type: "string", maxLength: 15, nullable: true },
                  isProfilePublic: { type: "boolean" },
                  preferredLanguage: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/User" }),
          "401": unauthorizedResponse,
          "409": {
            description: "ユーザー名がすでに使用されています",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "422": validationErrorResponse,
        },
      },
    },

    "/api/users/me/avatar": {
      post: {
        tags: ["Users"],
        summary: "アバター画像アップロード",
        description: "認証ユーザーのアバター画像をアップロードする",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["avatar"],
                properties: {
                  avatar: {
                    type: "string",
                    format: "binary",
                    description: "アバター画像ファイル（JPEG/PNG/GIF/WebP）",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/User" }),
          "400": {
            description: "ファイル形式が不正です",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": unauthorizedResponse,
          "500": internalErrorResponse,
        },
      },
    },

    "/api/users/{id}/articles": {
      get: {
        tags: ["Users"],
        summary: "ユーザーの公開記事一覧取得",
        description: "指定ユーザーの公開記事一覧を取得する（認証不要）",
        security: [],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ユーザーID",
          },
          ...paginationParams,
        ],
        responses: {
          "200": paginatedSuccessResponse({ $ref: "#/components/schemas/Article" }),
          "404": notFoundResponse,
          "422": validationErrorResponse,
        },
      },
    },

    "/api/users/{id}/follow": {
      post: {
        tags: ["Follows"],
        summary: "ユーザーをフォロー",
        description: "指定ユーザーをフォローする",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "フォロー対象ユーザーID",
          },
        ],
        responses: {
          "201": successResponse({
            type: "object",
            properties: {
              followerId: { type: "string" },
              followingId: { type: "string" },
              createdAt: { type: "string" },
            },
          }),
          "401": unauthorizedResponse,
          "404": notFoundResponse,
          "409": {
            description: "すでにフォローしています",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "422": validationErrorResponse,
        },
      },
      delete: {
        tags: ["Follows"],
        summary: "フォロー解除",
        description: "指定ユーザーのフォローを解除する",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "フォロー解除対象ユーザーID",
          },
        ],
        responses: {
          "204": { description: "フォロー解除成功" },
          "401": unauthorizedResponse,
          "404": notFoundResponse,
        },
      },
    },

    "/api/users/{id}/followers": {
      get: {
        tags: ["Follows"],
        summary: "フォロワー一覧取得",
        description: "指定ユーザーのフォロワー一覧をカーソルベースページネーションで取得する",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ユーザーID",
          },
          ...paginationParams,
        ],
        responses: {
          "200": paginatedSuccessResponse({ $ref: "#/components/schemas/User" }),
          "401": unauthorizedResponse,
          "404": notFoundResponse,
          "422": validationErrorResponse,
        },
      },
    },

    "/api/users/{id}/following": {
      get: {
        tags: ["Follows"],
        summary: "フォロー中一覧取得",
        description:
          "指定ユーザーのフォロー中ユーザー一覧をカーソルベースページネーションで取得する",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ユーザーID",
          },
          ...paginationParams,
        ],
        responses: {
          "200": paginatedSuccessResponse({ $ref: "#/components/schemas/User" }),
          "401": unauthorizedResponse,
          "404": notFoundResponse,
          "422": validationErrorResponse,
        },
      },
    },

    "/api/tags": {
      get: {
        tags: ["Tags"],
        summary: "タグ一覧取得",
        description: "認証ユーザーのタグ一覧を取得する",
        responses: {
          "200": successResponse({
            type: "array",
            items: { $ref: "#/components/schemas/Tag" },
          }),
          "401": unauthorizedResponse,
        },
      },
      post: {
        tags: ["Tags"],
        summary: "タグ作成",
        description: "新しいタグを作成する",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 50 },
                },
              },
            },
          },
        },
        responses: {
          "201": successResponse({ $ref: "#/components/schemas/Tag" }),
          "401": unauthorizedResponse,
          "409": {
            description: "タグがすでに存在します",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "422": validationErrorResponse,
        },
      },
    },

    "/api/tags/{id}": {
      delete: {
        tags: ["Tags"],
        summary: "タグ削除",
        description: "指定IDのタグを削除する（所有者のみ）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { description: "削除成功" },
          "401": unauthorizedResponse,
          "404": notFoundResponse,
        },
      },
    },

    "/api/search": {
      get: {
        tags: ["Search"],
        summary: "記事全文検索",
        description: "タイトル・内容・抜粋をLIKE検索する（カーソルベースページネーション対応）",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            description: "検索キーワード（最大200文字）",
            schema: { type: "string", maxLength: 200 },
          },
          ...paginationParams,
        ],
        responses: {
          "200": paginatedSuccessResponse({ $ref: "#/components/schemas/Article" }),
          "401": unauthorizedResponse,
          "422": validationErrorResponse,
        },
      },
    },

    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "通知一覧取得",
        description: "認証ユーザーの通知一覧をカーソルベースページネーションで取得する",
        parameters: paginationParams,
        responses: {
          "200": paginatedSuccessResponse({ $ref: "#/components/schemas/Notification" }),
          "401": unauthorizedResponse,
          "422": validationErrorResponse,
        },
      },
    },

    "/api/register": {
      post: {
        tags: ["Notifications"],
        summary: "プッシュトークン登録",
        description: "モバイルのプッシュ通知トークンを登録する",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "platform"],
                properties: {
                  token: {
                    type: "string",
                    maxLength: 512,
                    description: "プッシュ通知トークン",
                  },
                  platform: {
                    type: "string",
                    enum: ["ios", "android"],
                    description: "プラットフォーム",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": successResponse({
            type: "object",
            properties: {
              id: { type: "string" },
              token: { type: "string" },
              platform: { type: "string", enum: ["ios", "android"] },
            },
          }),
          "401": unauthorizedResponse,
          "422": validationErrorResponse,
          "500": internalErrorResponse,
        },
      },
    },

    "/api/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "通知既読化",
        description: "指定IDの通知を既読にする（所有者のみ）",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": successResponse({ $ref: "#/components/schemas/Notification" }),
          "401": unauthorizedResponse,
          "404": notFoundResponse,
          "500": internalErrorResponse,
        },
      },
    },

    "/api/subscription/status": {
      get: {
        tags: ["Subscription"],
        summary: "サブスクリプション状態確認",
        description: "認証ユーザーのサブスクリプション（プレミアム）状態を取得する",
        responses: {
          "200": successResponse({
            type: "object",
            properties: {
              isPremium: { type: "boolean" },
              premiumExpiresAt: { type: "string", format: "date-time", nullable: true },
            },
          }),
          "401": unauthorizedResponse,
          "404": notFoundResponse,
        },
      },
    },

    "/api/subscription/webhooks/revenuecat": {
      post: {
        tags: ["Subscription"],
        summary: "RevenueCat Webhook受信",
        description:
          "RevenueCatからのWebhookイベントを受信し、サブスクリプション状態を更新する。BearerトークンにWebhookシークレットを指定すること",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["event"],
                properties: {
                  event: {
                    type: "object",
                    required: ["type", "app_user_id"],
                    properties: {
                      type: {
                        type: "string",
                        description: "イベントタイプ（INITIAL_PURCHASE, RENEWAL, EXPIRATION など）",
                      },
                      app_user_id: { type: "string", description: "RevenueCat ユーザーID" },
                      expiration_at_ms: {
                        type: "number",
                        description: "有効期限（ミリ秒タイムスタンプ）",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse({
            type: "object",
            properties: {
              message: { type: "string" },
            },
          }),
          "400": {
            description: "リクエストが不正です",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": unauthorizedResponse,
        },
      },
    },

    "/openapi.json": {
      get: {
        tags: ["System"],
        summary: "OpenAPI仕様取得",
        description: "このAPI仕様自体をJSON形式で取得する",
        security: [],
        responses: {
          "200": {
            description: "OpenAPI 3.0 仕様",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
  },
};
