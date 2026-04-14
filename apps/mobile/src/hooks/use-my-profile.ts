import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { ApiErrorPayload } from "@/types/api-error";
import { isApiErrorPayload } from "@/types/api-error";
import type {
  MeProfile,
  MeProfileResponse,
  UpdateProfileInput,
  UpdateProfileResponse,
} from "@/types/me";

/** 自分のプロフィールのクエリキー */
export const MY_PROFILE_QUERY_KEY = "my-profile";

/** アバター画像の JPEG MIME タイプ */
const MIME_TYPE_JPEG = "image/jpeg";

/** アバター画像の PNG MIME タイプ */
const MIME_TYPE_PNG = "image/png";

/** アバター画像の WebP MIME タイプ */
const MIME_TYPE_WEBP = "image/webp";

/** アバター画像の HEIC MIME タイプ（iOS 撮影画像） */
const MIME_TYPE_HEIC = "image/heic";

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
      const data = await apiFetch<UpdateProfileResponse | ApiErrorPayload>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      if (isApiErrorPayload(data)) {
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
 * PNG / WebP / HEIC(HEIF) に対応し、その他は JPEG とみなす
 *
 * @param filename - ファイル名
 * @returns MIME タイプ文字列
 */
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === EXT_PNG) return MIME_TYPE_PNG;
  if (ext === "webp") return MIME_TYPE_WEBP;
  if (ext === "heic" || ext === "heif") return MIME_TYPE_HEIC;
  return MIME_TYPE_JPEG;
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
      /**
       * React Native の fetch は FormData を渡すと Content-Type を自動で
       * multipart/form-data; boundary=... に設定するため、
       * { uri, name, type } オブジェクトを Blob として渡す必要がある。
       */
      form.append(AVATAR_FIELD_NAME, { uri, name: filename, type } as unknown as Blob);

      const data = await apiFetch<UpdateProfileResponse | ApiErrorPayload>("/api/users/me/avatar", {
        method: "POST",
        body: form,
      });
      if (isApiErrorPayload(data)) {
        throw data;
      }
      return (data as UpdateProfileResponse).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MY_PROFILE_QUERY_KEY] });
    },
  });
}
