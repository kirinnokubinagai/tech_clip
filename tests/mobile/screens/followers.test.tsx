import FollowersScreen from "@mobile-app/profile/followers";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

/** フォロワーリストのモックデータ */
const MOCK_FOLLOWERS = [
  { id: "1", name: "田中太郎", bio: "フロントエンドエンジニア", avatarUrl: null },
  { id: "2", name: "佐藤花子", bio: "バックエンドエンジニア", avatarUrl: null },
];

/** フォロー中リストのモックデータ */
const MOCK_FOLLOWING = [{ id: "3", name: "高橋実", bio: "モバイルエンジニア", avatarUrl: null }];

const mockBack = jest.fn();
const mockPush = jest.fn();

const mockUseLocalSearchParams = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

const mockUseFollowers = jest.fn();
const mockUseFollowing = jest.fn();

jest.mock("@mobile/hooks/use-follow", () => ({
  useFollowers: () => mockUseFollowers(),
  useFollowing: () => mockUseFollowing(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({ tab: "followers" });
  mockUseFollowers.mockReturnValue({
    data: MOCK_FOLLOWERS,
    isLoading: false,
    isError: false,
  });
  mockUseFollowing.mockReturnValue({
    data: MOCK_FOLLOWING,
    isLoading: false,
    isError: false,
  });
});

describe("FollowersScreen", () => {
  describe("フォロワータブ", () => {
    it("初期タブがfollowersの場合フォロワーリストが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ tab: "followers" });

      // Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("followers-list")).not.toBeNull();
      });
    });

    it("フォロワーのユーザー名が表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ tab: "followers" });

      // Act
      const { getByText } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("田中太郎")).not.toBeNull();
        expect(getByText("佐藤花子")).not.toBeNull();
      });
    });
  });

  describe("フォロー中タブ", () => {
    it("タブ切り替えでフォロー中リストが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ tab: "followers" });

      // Act
      const { getByTestId, getByText } = await render(<FollowersScreen />);
      await fireEvent.press(getByTestId("tab-following"));

      // Assert
      await waitFor(() => {
        expect(getByText("高橋実")).not.toBeNull();
      });
    });

    it("初期タブがfollowingの場合フォロー中リストが表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ tab: "following" });

      // Act
      const { getByText } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByText("高橋実")).not.toBeNull();
      });
    });
  });

  describe("ローディング状態", () => {
    it("フォロワーデータロード中はローディング表示になること", async () => {
      // Arrange
      mockUseFollowers.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      // Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("followers-loading")).not.toBeNull();
      });
    });
  });

  describe("エラー状態", () => {
    it("フォロワーデータ取得失敗時はエラー表示になること", async () => {
      // Arrange
      mockUseFollowers.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      });

      // Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("followers-error")).not.toBeNull();
      });
    });
  });

  describe("空状態", () => {
    it("フォロワーが0人の場合は空状態が表示されること", async () => {
      // Arrange
      mockUseFollowers.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
      });

      // Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("followers-empty")).not.toBeNull();
      });
    });

    it("フォロー中が0人の場合は空状態が表示されること", async () => {
      // Arrange
      mockUseLocalSearchParams.mockReturnValue({ tab: "following" });
      mockUseFollowing.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
      });

      // Act
      const { getByTestId } = await render(<FollowersScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("followers-empty")).not.toBeNull();
      });
    });
  });

  describe("ナビゲーション", () => {
    it("戻るボタンを押すとrouter.backが呼ばれること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowersScreen />);
      await fireEvent.press(getByTestId("followers-back-button"));

      // Assert
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it("ユーザーアイテムをタップするとプロフィール画面に遷移すること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<FollowersScreen />);
      await fireEvent.press(getByTestId("user-item-1"));

      // Assert
      expect(mockPush).toHaveBeenCalledWith("/profile/1");
    });
  });
});
