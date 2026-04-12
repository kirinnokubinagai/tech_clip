import FollowersScreen from "@mobile-app/profile/followers";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

/** モックデータ: フォロワー一覧 */
const MOCK_FOLLOWERS_PAGE = {
  items: [
    { id: "user-1", name: "田中太郎", bio: "フロントエンドエンジニア", avatarUrl: null },
    { id: "user-2", name: "佐藤花子", bio: null, avatarUrl: null },
  ],
  nextCursor: null,
  hasNext: false,
};

/** モックデータ: フォロー中一覧 */
const MOCK_FOLLOWING_PAGE = {
  items: [{ id: "user-3", name: "鈴木一郎", bio: "バックエンドエンジニア", avatarUrl: null }],
  nextCursor: null,
  hasNext: false,
};

/** mockFollowers の参照（テスト間で変更可能） */
const mockFollowersState = {
  isLoading: false,
  isError: false,
  data: { pages: [MOCK_FOLLOWERS_PAGE] as (typeof MOCK_FOLLOWERS_PAGE)[] },
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: jest.fn(),
  refetch: jest.fn(),
};

/** mockFollowing の参照（テスト間で変更可能） */
const mockFollowingState = {
  isLoading: false,
  isError: false,
  data: { pages: [MOCK_FOLLOWING_PAGE] as (typeof MOCK_FOLLOWING_PAGE)[] },
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: jest.fn(),
  refetch: jest.fn(),
};

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ tab: "followers", userId: "self-user-id" }),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock("@mobile/hooks/use-follows", () => ({
  useFollowers: () => ({ ...mockFollowersState }),
  useFollowing: () => ({ ...mockFollowingState }),
}));

jest.mock("@mobile/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: { id: "self-user-id", name: "自分", email: "me@example.com" },
      isAuthenticated: true,
    }),
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFollowersState.isLoading = false;
  mockFollowersState.isError = false;
  mockFollowersState.data = { pages: [MOCK_FOLLOWERS_PAGE] };
  mockFollowersState.hasNextPage = false;
  mockFollowingState.isLoading = false;
  mockFollowingState.isError = false;
  mockFollowingState.data = { pages: [MOCK_FOLLOWING_PAGE] };
  mockFollowingState.hasNextPage = false;
});

describe("FollowersScreen", () => {
  describe("画面表示", () => {
    it("フォロワー画面が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      expect(getByTestId("followers-screen")).not.toBeNull();
    });

    it("タブが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      expect(getByTestId("followers-tabs")).not.toBeNull();
      expect(getByTestId("tab-followers")).not.toBeNull();
      expect(getByTestId("tab-following")).not.toBeNull();
    });

    it("戻るボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      expect(getByTestId("followers-back-button")).not.toBeNull();
    });
  });

  describe("フォロワーリスト", () => {
    it("フォロワー一覧が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("user-item-user-1")).not.toBeNull();
        expect(getByTestId("user-item-user-2")).not.toBeNull();
      });
    });

    it("フォロワーの名前が表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("田中太郎")).not.toBeNull();
        expect(getByText("佐藤花子")).not.toBeNull();
      });
    });

    it("フォロワーのbioが表示されること", async () => {
      // Arrange & Act
      const { getByText } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("フロントエンドエンジニア")).not.toBeNull();
      });
    });
  });

  describe("フォロー中リスト", () => {
    it("フォロー中タブに切り替えるとフォロー中ユーザーが表示されること", async () => {
      // Arrange
      const { getByTestId, getByText } = await render(<FollowersScreen />);

      // Act
      await fireEvent.press(getByTestId("tab-following"));

      // Assert
      await waitFor(() => {
        expect(getByText("鈴木一郎")).not.toBeNull();
      });
    });
  });

  describe("ローディング状態", () => {
    it("ローディング中はインジケーターが表示されること", async () => {
      // Arrange
      mockFollowersState.isLoading = true;
      mockFollowersState.data = { pages: [] };

      // Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      expect(getByTestId("followers-loading")).not.toBeNull();
    });
  });

  describe("空状態", () => {
    it("フォロワーがいない場合に空状態が表示されること", async () => {
      // Arrange
      mockFollowersState.data = { pages: [{ items: [], nextCursor: null, hasNext: false }] };

      // Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("followers-empty")).not.toBeNull();
      });
    });
  });

  describe("エラー状態", () => {
    it("エラー発生時にエラー表示が表示されること", async () => {
      // Arrange
      mockFollowersState.isError = true;
      mockFollowersState.data = { pages: [] };

      // Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      expect(getByTestId("followers-error")).not.toBeNull();
    });
  });

  describe("無限スクロール", () => {
    it("リスト末尾に達したとき fetchNextPage が呼ばれること", async () => {
      // Arrange
      mockFollowersState.hasNextPage = true;

      // Act
      const { getByTestId } = await render(<FollowersScreen />);
      fireEvent(getByTestId("followers-list"), "onEndReached");

      // Assert
      expect(mockFollowersState.fetchNextPage).toHaveBeenCalled();
    });
  });

  describe("ナビゲーション", () => {
    it("ユーザーアイテムをタップするとプロフィール画面に遷移すること", async () => {
      // Arrange
      const { getByTestId } = await render(<FollowersScreen />);

      // Act
      await fireEvent.press(getByTestId("user-item-user-1"));

      // Assert
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/profile/user-1");
      });
    });

    it("戻るボタンをタップすると前の画面に戻ること", async () => {
      // Arrange
      const { getByTestId } = await render(<FollowersScreen />);

      // Act
      await fireEvent.press(getByTestId("followers-back-button"));

      // Assert
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
