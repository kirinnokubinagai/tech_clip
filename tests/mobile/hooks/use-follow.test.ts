import { followKeys, useFollowers, useFollowing } from "@mobile/hooks/use-follow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
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

/** フォロワー一覧のモックレスポンス */
const mockFollowersResponse = {
  success: true,
  data: [
    {
      id: "user_01",
      name: "テストユーザー1",
      bio: "テストのbio",
      avatarUrl: null,
    },
    {
      id: "user_02",
      name: "テストユーザー2",
      bio: null,
      avatarUrl: "https://example.com/avatar.jpg",
    },
  ],
};

/** フォロー中一覧のモックレスポンス */
const mockFollowingResponse = {
  success: true,
  data: [
    {
      id: "user_03",
      name: "フォロー中ユーザー",
      bio: "フォロー中のbio",
      avatarUrl: null,
    },
  ],
};

describe("followKeys", () => {
  describe("クエリキーファクトリー", () => {
    it("allキーが正しく生成されること", () => {
      // Arrange / Act / Assert
      expect(followKeys.all).toEqual(["follow"]);
    });

    it("followersキーにuserIdが含まれること", () => {
      // Arrange
      const userId = "user_01";

      // Act
      const key = followKeys.followers(userId);

      // Assert
      expect(key).toEqual(["follow", "followers", userId]);
    });

    it("followersキーのuserIdがundefinedの場合も生成できること", () => {
      // Arrange / Act
      const key = followKeys.followers(undefined);

      // Assert
      expect(key).toEqual(["follow", "followers", undefined]);
    });

    it("followingキーにuserIdが含まれること", () => {
      // Arrange
      const userId = "user_01";

      // Act
      const key = followKeys.following(userId);

      // Assert
      expect(key).toEqual(["follow", "following", userId]);
    });

    it("followingキーのuserIdがundefinedの場合も生成できること", () => {
      // Arrange / Act
      const key = followKeys.following(undefined);

      // Assert
      expect(key).toEqual(["follow", "following", undefined]);
    });
  });
});

describe("useFollowers", () => {
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
    it("自分のフォロワー一覧を取得できること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockFollowersResponse);

      // Act
      const { result } = await renderHook(() => useFollowers(), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedApiFetch).toHaveBeenCalledWith("/api/users/me/followers");
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe("テストユーザー1");
    });

    it("指定したユーザーのフォロワー一覧を取得できること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockFollowersResponse);
      const userId = "user_01";

      // Act
      const { result } = await renderHook(() => useFollowers(userId), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedApiFetch).toHaveBeenCalledWith(`/api/users/${userId}/followers`);
    });

    it("enabled=falseの場合はAPIを呼ばないこと", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockFollowersResponse);

      // Act
      await renderHook(() => useFollowers(undefined, { enabled: false }), { wrapper: Wrapper });

      // Assert
      await waitFor(() => {
        expect(mockedApiFetch).not.toHaveBeenCalled();
      });
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      mockedApiFetch.mockRejectedValue(new Error("ネットワークエラーが発生しました"));

      // Act
      const { result } = await renderHook(() => useFollowers(), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("ネットワークエラーが発生しました");
    });
  });
});

describe("useFollowing", () => {
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
    it("自分のフォロー中一覧を取得できること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockFollowingResponse);

      // Act
      const { result } = await renderHook(() => useFollowing(), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedApiFetch).toHaveBeenCalledWith("/api/users/me/following");
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].name).toBe("フォロー中ユーザー");
    });

    it("指定したユーザーのフォロー中一覧を取得できること", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockFollowingResponse);
      const userId = "user_01";

      // Act
      const { result } = await renderHook(() => useFollowing(userId), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedApiFetch).toHaveBeenCalledWith(`/api/users/${userId}/following`);
    });

    it("enabled=falseの場合はAPIを呼ばないこと", async () => {
      // Arrange
      mockedApiFetch.mockResolvedValue(mockFollowingResponse);

      // Act
      await renderHook(() => useFollowing(undefined, { enabled: false }), { wrapper: Wrapper });

      // Assert
      await waitFor(() => {
        expect(mockedApiFetch).not.toHaveBeenCalled();
      });
    });
  });

  describe("異常系", () => {
    it("APIエラー時にエラー状態になること", async () => {
      // Arrange
      mockedApiFetch.mockRejectedValue(new Error("サーバーエラーが発生しました"));

      // Act
      const { result } = await renderHook(() => useFollowing(), { wrapper: Wrapper });

      // Assert
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("サーバーエラーが発生しました");
    });
  });
});
