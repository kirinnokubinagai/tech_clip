import { useFollowers, useFollowing } from "@mobile/hooks/use-follows";
import { apiFetch } from "@mobile/lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

/** モックデータ: フォロワー一覧 */
const MOCK_FOLLOWERS = [
  {
    id: "user-1",
    name: "田中太郎",
    bio: "フロントエンドエンジニア",
    avatarUrl: null,
  },
  {
    id: "user-2",
    name: "佐藤花子",
    bio: null,
    avatarUrl: "https://example.com/avatar.jpg",
  },
];

/** モックデータ: フォロー中一覧 */
const MOCK_FOLLOWING = [
  {
    id: "user-3",
    name: "鈴木一郎",
    bio: "バックエンドエンジニア",
    avatarUrl: null,
  },
];

jest.mock("@mobile/lib/api", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = jest.mocked(apiFetch);

/** テスト用QueryClient */
let queryClient: QueryClient;

/**
 * テスト用QueryClientProviderラッパーを生成する
 *
 * @param client - QueryClient インスタンス
 * @returns ラッパーコンポーネント
 */
function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe("useFollowers", () => {
  it("フォロワー一覧を取得できること", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue({
      success: true,
      data: MOCK_FOLLOWERS,
      meta: { nextCursor: null, hasNext: false },
    });

    // Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowers("target-user-id"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].items).toHaveLength(2);
    expect(result.current.data?.pages[0].items[0].name).toBe("田中太郎");
  });

  it("APIエラー時にエラー状態になること", async () => {
    // Arrange
    mockApiFetch.mockRejectedValue(new Error("通信エラー"));

    // Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowers("target-user-id"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("ページネーション: hasNextがtrueの場合にhasNextPageがtrueになること", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue({
      success: true,
      data: MOCK_FOLLOWERS,
      meta: { nextCursor: "cursor-abc", hasNext: true },
    });

    // Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowers("target-user-id"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it("userIdが空の場合はリクエストを送らないこと", async () => {
    // Arrange & Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowers(""), { wrapper });

    // Assert
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("APIがsuccess:falseを返した場合にエラー状態になること", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" },
    });

    // Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowers("target-user-id"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useFollowing", () => {
  it("フォロー中一覧を取得できること", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue({
      success: true,
      data: MOCK_FOLLOWING,
      meta: { nextCursor: null, hasNext: false },
    });

    // Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowing("target-user-id"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].items[0].name).toBe("鈴木一郎");
  });

  it("APIエラー時にエラー状態になること", async () => {
    // Arrange
    mockApiFetch.mockRejectedValue(new Error("通信エラー"));

    // Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowing("target-user-id"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("hasNextがtrueの場合、次のページを取得できること", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue({
      success: true,
      data: MOCK_FOLLOWING,
      meta: { nextCursor: "cursor-xyz", hasNext: true },
    });

    // Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowing("target-user-id"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it("userIdが空の場合はリクエストを送らないこと", async () => {
    // Arrange & Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowing(""), { wrapper });

    // Assert
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("APIがsuccess:falseを返した場合にエラー状態になること", async () => {
    // Arrange
    mockApiFetch.mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" },
    });

    // Act
    const wrapper = createWrapper(queryClient);
    const { result } = await renderHook(() => useFollowing("target-user-id"), { wrapper });

    // Assert
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
