import ProfileEditScreen from "@mobile-app/profile/edit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

jest.mock("@/components/ui/Toast", () => ({
  Toast: jest.fn(() => null),
}));

const { Toast } = jest.requireMock("@/components/ui/Toast") as { Toast: jest.Mock };

jest.mock("@/lib/api", () => ({
  apiFetch: jest.fn(),
}));

const { apiFetch } = jest.requireMock("@/lib/api") as { apiFetch: jest.Mock };

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

const mockUpdateUserProfile = jest.fn();

jest.mock("@/stores/auth-store", () => ({
  useAuthStore: jest.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      user: { name: "テストユーザー", image: null },
      updateUserProfile: mockUpdateUserProfile,
    }),
  ),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}));

jest.spyOn(Alert, "alert");

/** テスト用プロフィールデータ */
const mockProfile = {
  id: "user_01",
  email: "test@example.com",
  name: "テストユーザー",
  image: null,
  avatarUrl: null,
  username: "testuser",
  bio: "テストのbioです",
  websiteUrl: "https://example.com",
  githubUsername: "testgithub",
  twitterUsername: "testtwitter",
  isProfilePublic: true,
  preferredLanguage: "ja",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

/** テスト用QueryClient */
let queryClient: QueryClient;

/** テスト用ラッパーコンポーネント */
function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  apiFetch.mockReset();
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

describe("ProfileEditScreen", () => {
  describe("初期値の取得", () => {
    it("初期値取得成功時にフォームに値が入ること", async () => {
      // Arrange
      apiFetch.mockResolvedValue({ success: true, data: mockProfile });

      // Act
      const { getByPlaceholderText } = await render(
        React.createElement(Wrapper, null, React.createElement(ProfileEditScreen)),
      );

      // Assert
      await waitFor(() => {
        const nameInput = getByPlaceholderText("名前を入力");
        expect(nameInput.props.value).toBe("テストユーザー");
      });
    });

    it("初期値取得失敗時にエラー UI が表示されること", async () => {
      // Arrange
      apiFetch.mockRejectedValue(new Error("ネットワークエラー"));

      // Act
      const { getByText } = await render(
        React.createElement(Wrapper, null, React.createElement(ProfileEditScreen)),
      );

      // Assert
      await waitFor(() => {
        expect(getByText("プロフィールの取得に失敗しました")).toBeDefined();
      });
    });
  });

  describe("保存成功時のフィードバック", () => {
    it("保存ボタンを押すと router.back() が呼ばれること", async () => {
      // Arrange
      apiFetch
        .mockResolvedValueOnce({ success: true, data: mockProfile })
        .mockResolvedValueOnce({ success: true, data: mockProfile });

      // Act
      const { getByTestId, getByPlaceholderText } = await render(
        React.createElement(Wrapper, null, React.createElement(ProfileEditScreen)),
      );
      await waitFor(() => {
        expect(getByPlaceholderText("名前を入力").props.value).toBe("テストユーザー");
      });
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });
    });

    it("保存成功後にトーストが表示状態になること", async () => {
      // Arrange
      apiFetch
        .mockResolvedValueOnce({ success: true, data: mockProfile })
        .mockResolvedValueOnce({ success: true, data: mockProfile });

      // Act
      const { getByTestId, getByPlaceholderText } = await render(
        React.createElement(Wrapper, null, React.createElement(ProfileEditScreen)),
      );
      await waitFor(() => {
        expect(getByPlaceholderText("名前を入力").props.value).toBe("テストユーザー");
      });
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        expect(Toast).toHaveBeenLastCalledWith(
          expect.objectContaining({ visible: true, message: "プロフィールを更新しました" }),
          undefined,
        );
      });
    });

    it("保存成功後に auth store が更新されること", async () => {
      // Arrange
      const updatedProfile = { ...mockProfile, name: "テストユーザー" };
      apiFetch
        .mockResolvedValueOnce({ success: true, data: mockProfile })
        .mockResolvedValueOnce({ success: true, data: updatedProfile });

      // Act
      const { getByTestId, getByPlaceholderText } = await render(
        React.createElement(Wrapper, null, React.createElement(ProfileEditScreen)),
      );
      await waitFor(() => {
        expect(getByPlaceholderText("名前を入力").props.value).toBe("テストユーザー");
      });
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalled();
      });
    });
  });

  describe("バリデーションエラー", () => {
    it("名前が空の場合エラーメッセージが表示されること", async () => {
      // Arrange
      apiFetch.mockResolvedValueOnce({ success: true, data: mockProfile });

      // Act
      const { getByTestId, getByPlaceholderText, getByText } = await render(
        React.createElement(Wrapper, null, React.createElement(ProfileEditScreen)),
      );
      await waitFor(() => {
        expect(getByPlaceholderText("名前を入力").props.value).toBe("テストユーザー");
      });
      const nameInput = getByPlaceholderText("名前を入力");
      await fireEvent.changeText(nameInput, "");
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        expect(getByText("名前を入力してください")).toBeDefined();
      });
    });
  });

  describe("username 重複エラー (409)", () => {
    it("409 エラー時に username 欄にエラーが表示されること", async () => {
      // Arrange
      const profileWithDifferentUsername = { ...mockProfile, username: "original" };
      apiFetch
        .mockResolvedValueOnce({ success: true, data: profileWithDifferentUsername })
        .mockResolvedValueOnce({
          success: false,
          error: { code: "DUPLICATE", message: "このユーザー名はすでに使用されています" },
        });

      // Act
      const { getByTestId, getByPlaceholderText, getByText } = await render(
        React.createElement(Wrapper, null, React.createElement(ProfileEditScreen)),
      );
      await waitFor(() => {
        expect(getByPlaceholderText("名前を入力").props.value).toBe("テストユーザー");
      });

      const usernameInput = getByPlaceholderText("username");
      await fireEvent.changeText(usernameInput, "newusername");
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        expect(getByText("このユーザー名はすでに使用されています")).toBeDefined();
      });
    });
  });

  describe("アバター変更", () => {
    it("アバター変更時に POST /api/users/me/avatar が呼ばれること", async () => {
      // Arrange
      const mockUri = "file:///path/to/avatar.jpg";
      const ImagePicker = jest.requireMock("expo-image-picker") as {
        requestMediaLibraryPermissionsAsync: jest.Mock;
        launchImageLibraryAsync: jest.Mock;
      };
      ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: mockUri }],
      });

      const profileWithAvatar = { ...mockProfile, avatarUrl: "https://example.com/new-avatar.jpg" };
      apiFetch
        .mockResolvedValueOnce({ success: true, data: mockProfile })
        .mockResolvedValueOnce({ success: true, data: profileWithAvatar })
        .mockResolvedValueOnce({ success: true, data: profileWithAvatar });

      // Act
      const { getByTestId, getByPlaceholderText } = await render(
        React.createElement(Wrapper, null, React.createElement(ProfileEditScreen)),
      );
      await waitFor(() => {
        expect(getByPlaceholderText("名前を入力").props.value).toBe("テストユーザー");
      });
      await fireEvent.press(getByTestId("profile-edit-avatar-button"));
      await waitFor(() => {
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
      });
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          "/api/users/me/avatar",
          expect.objectContaining({ method: "POST" }),
        );
      });
    });
  });

  describe("変更なし保存", () => {
    it("何も変更せず保存を押した場合 PATCH API を呼ばずに router.back() が呼ばれること", async () => {
      // Arrange
      apiFetch.mockResolvedValueOnce({ success: true, data: mockProfile });

      // Act
      const { getByTestId, getByPlaceholderText } = await render(
        React.createElement(Wrapper, null, React.createElement(ProfileEditScreen)),
      );
      await waitFor(() => {
        expect(getByPlaceholderText("名前を入力").props.value).toBe("テストユーザー");
      });

      const initialCallCount = apiFetch.mock.calls.length;
      await fireEvent.press(getByTestId("button"));

      // Assert
      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });

      const patchCalls = apiFetch.mock.calls
        .slice(initialCallCount)
        .filter((c: unknown[]) => c[1] !== undefined);
      expect(patchCalls).toHaveLength(0);
    });
  });
});
