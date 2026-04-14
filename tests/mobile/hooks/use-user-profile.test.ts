import { useUserProfile } from "@mobile/hooks/use-user-profile";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

const apiFetch = require("@/lib/api").apiFetch as jest.Mock;

/** テスト用QueryClient */
let queryClient: QueryClient;

/** テスト用QueryClientProviderラッパー */
function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

/** テスト用ユーザーID */
const TEST_USER_ID = "user_01HXYZ";

/** 公開プロフィールのモックレスポンス */
const mockProfileResponse = {
  success: true,
  data: {
    id: TEST_USER_ID,
    name: "テストユーザー",
    username: "testuser",
    bio: "技術記事が好きなエンジニアです。",
    avatarUrl: null,
    followersCount: 42,
    followingCount: 18,
  },
};

/** エラーレスポンスのモック */
const mockNotFoundResponse = {
  success: false,
  error: {
    code: "NOT_FOUND",
    message: "ユーザーが見つかりません",
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

  it("ユーザープロフィールを正常に取得できること", async () => {
    // Arrange
    apiFetch.mockResolvedValue(mockProfileResponse);

    // Act
    const { result } = await renderHook(() => useUserProfile(TEST_USER_ID), {
      wrapper: Wrapper,
    });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetch).toHaveBeenCalledWith(`/api/users/${TEST_USER_ID}/profile`);
    expect(result.current.data).toEqual(mockProfileResponse.data);
  });

  it("ユーザーが存在しない場合はエラーになること", async () => {
    // Arrange
    apiFetch.mockResolvedValue(mockNotFoundResponse);

    // Act
    const { result } = await renderHook(() => useUserProfile(TEST_USER_ID), {
      wrapper: Wrapper,
    });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(apiFetch).toHaveBeenCalledWith(`/api/users/${TEST_USER_ID}/profile`);
  });

  it("userId が空の場合はクエリが実行されないこと", async () => {
    // Arrange
    apiFetch.mockResolvedValue(mockProfileResponse);

    // Act
    renderHook(() => useUserProfile(""), {
      wrapper: Wrapper,
    });

    // Assert
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
