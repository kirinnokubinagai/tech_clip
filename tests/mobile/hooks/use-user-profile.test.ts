// External packages

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

// Internal modules

import { followKeys } from "@mobile/hooks/use-follow";
import {
  USER_PROFILE_QUERY_KEY,
  useFollowToggle,
  useUserProfile,
} from "@mobile/hooks/use-user-profile";

// Path aliases

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

/** ユーザープロフィールのモックレスポンス */
const mockProfileResponse = {
  success: true,
  data: {
    id: "user_01",
    name: "テストユーザー",
    bio: "テストのbioです",
    avatarUrl: null,
    followersCount: 10,
    followingCount: 5,
    isFollowing: false,
  },
};

describe("useUserProfile", () => {
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
    it("ユーザープロフィールを取得できること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockProfileResponse);
      const userId = "user_01";

      // Act
      const { result } = await renderHook(() => useUserProfile(userId), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedApiFetch).toHaveBeenCalledWith(`/api/users/${userId}/profile`);
      expect(result.current.data?.name).toBe("テストユーザー");
      expect(result.current.data?.isFollowing).toBe(false);
    });

    it("フォロー状態がtrueのプロフィールを取得できること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue({
        ...mockProfileResponse,
        data: { ...mockProfileResponse.data, isFollowing: true },
      });

      // Act
      const { result } = await renderHook(() => useUserProfile("user_01"), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.isFollowing).toBe(true);
    });
  });

  describe("異常系", () => {
    it("userIdが空文字の場合はAPIを呼ばないこと", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockProfileResponse);

      // Act
      await renderHook(() => useUserProfile(""), { wrapper: Wrapper });

      // Assert
      await waitFor(() => {
        expect(mockedApiFetch).not.toHaveBeenCalled();
      });
    });

    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      mockedApiFetch.mockRejectedValue(new Error("ユーザーが見つかりません"));

      // Act
      const { result } = await renderHook(() => useUserProfile("user_01"), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("ユーザーが見つかりません");
    });
  });
});

describe("useFollowToggle", () => {
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
    it("フォローできること（POSTが呼ばれること）", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue({ success: true });
      const userId = "user_01";

      // Act
      const { result } = await renderHook(() => useFollowToggle(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.mutateAsync({ userId, isFollowing: false });
      });

      // Assert
      expect(mockedApiFetch).toHaveBeenCalledWith(`/api/users/${userId}/follow`, {
        method: "POST",
      });
    });

    it("フォロー解除できること（DELETEが呼ばれること）", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue({ success: true });
      const userId = "user_01";

      // Act
      const { result } = await renderHook(() => useFollowToggle(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.mutateAsync({ userId, isFollowing: true });
      });

      // Assert
      expect(mockedApiFetch).toHaveBeenCalledWith(`/api/users/${userId}/follow`, {
        method: "DELETE",
      });
    });

    it("成功後にユーザープロフィールのキャッシュが無効化されること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue({ success: true });
      const userId = "user_01";
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      // Act
      const { result } = await renderHook(() => useFollowToggle(), { wrapper: Wrapper });
      await act(async () => {
        await result.current.mutateAsync({ userId, isFollowing: false });
      });

      // Assert
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [USER_PROFILE_QUERY_KEY, userId] }),
      );
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: followKeys.all }),
      );
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラーがPromiseとして伝播されること", async () => {
      // Arrange
      mockedApiFetch.mockRejectedValue(new Error("フォロー処理に失敗しました"));

      // Act
      const { result } = await renderHook(() => useFollowToggle(), { wrapper: Wrapper });

      let thrownError: Error | undefined;
      await act(async () => {
        try {
          await result.current.mutateAsync({ userId: "user_01", isFollowing: false });
        } catch (e) {
          thrownError = e as Error;
        }
      });

      // Assert
      expect(thrownError?.message).toBe("フォロー処理に失敗しました");
    });
  });
});
