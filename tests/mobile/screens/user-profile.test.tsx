import UserProfileScreen from "@mobile-app/profile/[id]";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

/** モックユーザーデータ */
const MOCK_USER_PROFILE = {
  id: "user-abc",
  name: "山田太郎",
  bio: "技術記事が好きなエンジニアです。",
  avatarUrl: null,
  followersCount: 42,
  followingCount: 18,
  isFollowing: false,
};

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ id: "user-abc" }),
}));

const mockUseUserProfile = jest.fn();
const mockUseFollowToggle = jest.fn();

jest.mock("@mobile/hooks/use-user-profile", () => ({
  useUserProfile: () => mockUseUserProfile(),
  useFollowToggle: () => mockUseFollowToggle(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUserProfile.mockReturnValue({
    data: MOCK_USER_PROFILE,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
  mockUseFollowToggle.mockReturnValue({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
  });
});

describe("UserProfileScreen", () => {
  describe("正常表示", () => {
    it("ユーザー名が表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<UserProfileScreen />);

      // Assert
      await waitFor(() => {
        const name = getByTestId("profile-name");
        expect(name.props.children).toBe("山田太郎");
      });
    });

    it("フォローボタンが表示されること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<UserProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("follow-button")).not.toBeNull();
      });
    });

    it("フォロー済み（isFollowing: true）の場合、フォローボタンが『フォロー中』と表示されること", async () => {
      // Arrange
      mockUseUserProfile.mockReturnValue({
        data: { ...MOCK_USER_PROFILE, isFollowing: true },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      });

      // Act
      const { getByTestId } = await render(<UserProfileScreen />);

      // Assert
      await waitFor(() => {
        const label = getByTestId("follow-button-label");
        expect(label.props.children).toBe("フォロー中");
      });
    });
  });

  describe("ローディング状態", () => {
    it("データ取得中はローディング表示になること", async () => {
      // Arrange
      mockUseUserProfile.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: jest.fn(),
      });

      // Act
      const { getByTestId } = await render(<UserProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("user-profile-loading")).not.toBeNull();
      });
    });
  });

  describe("エラー状態", () => {
    it("データ取得失敗時はエラー表示になること", async () => {
      // Arrange
      mockUseUserProfile.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: jest.fn(),
      });

      // Act
      const { getByTestId } = await render(<UserProfileScreen />);

      // Assert
      await waitFor(() => {
        expect(getByTestId("user-profile-error")).not.toBeNull();
      });
    });

    it("再試行ボタンを押すとrefetchが呼ばれること", async () => {
      // Arrange
      const mockRefetch = jest.fn();
      mockUseUserProfile.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
      });

      // Act
      const { getByText } = await render(<UserProfileScreen />);
      await fireEvent.press(getByText("再試行"));

      // Assert
      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("フォローボタン操作", () => {
    it("フォローボタンを押すとmutateAsyncが正しい引数で呼ばれること", async () => {
      // Arrange
      const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
      mockUseFollowToggle.mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: mockMutateAsync,
        isPending: false,
      });

      // Act
      const { getByTestId } = await render(<UserProfileScreen />);
      await fireEvent.press(getByTestId("follow-button"));

      // Assert
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          userId: MOCK_USER_PROFILE.id,
          isFollowing: MOCK_USER_PROFILE.isFollowing,
        });
      });
    });
  });

  describe("ナビゲーション", () => {
    it("戻るボタンを押すとrouter.backが呼ばれること", async () => {
      // Arrange & Act
      const { getByTestId } = await render(<UserProfileScreen />);
      await fireEvent.press(getByTestId("user-profile-back-button"));

      // Assert
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });
});
