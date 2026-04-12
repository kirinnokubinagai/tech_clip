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
        expect(getByTestId("follow-button")).toBeDefined();
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
        expect(getByTestId("user-profile-loading")).toBeDefined();
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
        expect(getByTestId("user-profile-error")).toBeDefined();
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
