import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type {
  MeProfile,
  MeProfileResponse,
  UpdateProfileInput,
  UpdateProfileResponse,
} from "@/types/me";

/** API エラーレスポンスの型 */
type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
};

/**
 * API レスポンスがエラーペイロードかどうかを判定する
 *
 * @param value - 判定対象
 * @returns エラーペイロードなら true
 */
function isApiError(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const maybe = value as { success?: unknown; error?: unknown };
  return maybe.success === false && typeof maybe.error === "object" && maybe.error !== null;
}

/** 自分のプロフィールのクエリキー */
export const MY_PROFILE_QUERY_KEY = "my-profile";

/** アバター画像の JPEG MIME タイプ */
const MIME_TYPE_JPEG = "image/jpeg";

/** アバター画像の PNG MIME タイプ */
const MIME_TYPE_PNG = "image/png";

/** アバター画像拡張子が PNG の場合の判定文字列 */
const EXT_PNG = "png";

/** FormData のアバターフィールド名 */
const AVATAR_FIELD_NAME = "avatar";

/** デフォルトのアバターファイル名 */
const DEFAULT_AVATAR_FILENAME = "avatar.jpg";

/**
 * 自分のプロフィールを取得するフック
 *
 * @returns 自分のプロフィールのクエリ結果
 */
export function useMyProfile() {
  return useQuery({
    queryKey: [MY_PROFILE_QUERY_KEY],
    queryFn: async (): Promise<MeProfile> => {
      const data = await apiFetch<MeProfileResponse>("/api/users/me");
      return data.data;
    },
  });
}

/**
 * 自分のプロフィールを更新するフック
 *
 * @returns プロフィール更新のミューテーション
 */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<MeProfile> => {
      const data = await apiFetch<UpdateProfileResponse | ApiErrorResponse>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      if (isApiError(data)) {
        throw data;
      }
      return (data as UpdateProfileResponse).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MY_PROFILE_QUERY_KEY] });
    },
  });
}

/**
 * アバター画像の MIME タイプを拡張子から判定する
 *
 * @param filename - ファイル名
 * @returns MIME タイプ文字列
 */
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ext === EXT_PNG ? MIME_TYPE_PNG : MIME_TYPE_JPEG;
}

/**
 * アバター画像をアップロードするフック
 *
 * @returns アバターアップロードのミューテーション
 */
export function useUploadMyAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (uri: string): Promise<MeProfile> => {
      const form = new FormData();
      const filename = uri.split("/").pop() ?? DEFAULT_AVATAR_FILENAME;
      const type = getMimeType(filename);
      form.append(AVATAR_FIELD_NAME, { uri, name: filename, type } as unknown as Blob);

      const data = await apiFetch<UpdateProfileResponse | ApiErrorResponse>(
        "/api/users/me/avatar",
        {
          method: "POST",
          body: form,
          headers: { "Content-Type": undefined as unknown as string },
        },
      );
      if (isApiError(data)) {
        throw data;
      }
      return (data as UpdateProfileResponse).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MY_PROFILE_QUERY_KEY] });
    },
  });
}
