// External packages

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

// Internal modules

import {
  MY_PROFILE_QUERY_KEY,
  useMyProfile,
  useUpdateMyProfile,
  useUploadMyAvatar,
} from "@mobile/hooks/use-my-profile";
import type { MeProfile } from "@mobile/types/me";

import { apiFetch } from "@/lib/api";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

const mockedApiFetch = jest.mocked(apiFetch);

/** テスト用QueryClient */
let queryClient: QueryClient;

/** テスト用QueryClientProviderラッパー */
function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

/** プロフィールのモックデータ */
const mockProfile: MeProfile = {
  id: "user_01",
  email: "test@example.com",
  name: "テストユーザー",
  image: null,
  avatarUrl: "https://example.com/avatar.jpg",
  username: "testuser",
  bio: "テストのbioです",
  websiteUrl: "https://example.com",
  githubUsername: "testuser",
  twitterUsername: "testuser",
  isProfilePublic: true,
  preferredLanguage: "ja",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

/** プロフィール取得のモックレスポンス */
const mockProfileResponse = {
  success: true,
  data: mockProfile,
};

describe("useMyProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("正常系", () => {
    it("自分のプロフィールを取得できること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockProfileResponse);

      // Act
      const { result } = await renderHook(() => useMyProfile(), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedApiFetch).toHaveBeenCalledWith("/api/users/me");
      expect(result.current.data?.name).toBe("テストユーザー");
      expect(result.current.data?.username).toBe("testuser");
    });

    it("正しいクエリキーを使用すること", () => {
      // Arrange & Act & Assert
      expect(MY_PROFILE_QUERY_KEY).toBe("my-profile");
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      mockedApiFetch.mockRejectedValue(new Error("プロフィールの取得に失敗しました"));

      // Act
      const { result } = await renderHook(() => useMyProfile(), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("プロフィールの取得に失敗しました");
    });
  });
});

describe("useUpdateMyProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("正常系", () => {
    it("差分フィールドを PATCH /api/users/me に送信できること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockProfileResponse);

      // Act
      const { result } = await renderHook(() => useUpdateMyProfile(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.mutateAsync({ name: "新しい名前", bio: "新しいbio" });
      });

      // Assert
      expect(mockedApiFetch).toHaveBeenCalledWith("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name: "新しい名前", bio: "新しいbio" }),
      });
    });

    it("更新後にキャッシュが無効化されること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockProfileResponse);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      // Act
      const { result } = await renderHook(() => useUpdateMyProfile(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.mutateAsync({ name: "新しい名前" });
      });

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [MY_PROFILE_QUERY_KEY] }),
      );
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラーがPromiseとして伝播されること", async () => {
      // Arrange
      mockedApiFetch.mockRejectedValue(new Error("プロフィールの更新に失敗しました"));

      // Act
      const { result } = await renderHook(() => useUpdateMyProfile(), { wrapper: Wrapper });

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.mutateAsync({ name: "テスト" });
        } catch (e) {
          thrownError = e as Error;
        }
      });

      // Assert
      expect(thrownError?.message).toBe("プロフィールの更新に失敗しました");
    });
  });
});

describe("useUploadMyAvatar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("正常系", () => {
    it("FormDataで POST /api/users/me/avatar に送信できること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockProfileResponse);
      const uri = "file:///path/to/avatar.jpg";

      // Act
      const { result } = await renderHook(() => useUploadMyAvatar(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.mutateAsync(uri);
      });

      // Assert
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/users/me/avatar",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        }),
      );
    });

    it("アバターアップロード後にキャッシュが無効化されること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockProfileResponse);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      const uri = "file:///path/to/avatar.jpg";

      // Act
      const { result } = await renderHook(() => useUploadMyAvatar(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.mutateAsync(uri);
      });

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [MY_PROFILE_QUERY_KEY] }),
      );
    });
  });

  describe("異常系", () => {
    it("アップロード失敗時にエラーがPromiseとして伝播されること", async () => {
      // Arrange
      mockedApiFetch.mockRejectedValue(new Error("アバターのアップロードに失敗しました"));
      const uri = "file:///path/to/avatar.jpg";

      // Act
      const { result } = await renderHook(() => useUploadMyAvatar(), { wrapper: Wrapper });

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.mutateAsync(uri);
        } catch (e) {
          thrownError = e as Error;
        }
      });

      // Assert
      expect(thrownError?.message).toBe("アバターのアップロードに失敗しました");
    });
  });
});
