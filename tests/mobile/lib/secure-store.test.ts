jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from "expo-secure-store";

import {
  clearAuthTokens,
  getAuthToken,
  getOAuthState,
  getRefreshToken,
  removeAuthToken,
  removeOAuthState,
  removeRefreshToken,
  setAuthToken,
  setOAuthState,
  setRefreshToken,
} from "@/lib/secure-store";

const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<
  typeof SecureStore.setItemAsync
>;
const mockDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;

describe("secure-store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItemAsync.mockResolvedValue(undefined);
    mockDeleteItemAsync.mockResolvedValue(undefined);
  });

  describe("getAuthToken", () => {
    it("保存済みの認証トークンを取得できること", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue("test-token");

      // Act
      const result = await getAuthToken();

      // Assert
      expect(result).toBe("test-token");
      expect(mockGetItemAsync).toHaveBeenCalledWith("auth_token");
    });

    it("トークンが存在しない場合nullを返すこと", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue(null);

      // Act
      const result = await getAuthToken();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("setAuthToken", () => {
    it("認証トークンを保存できること", async () => {
      // Arrange
      const token = "new-auth-token";

      // Act
      await setAuthToken(token);

      // Assert
      expect(mockSetItemAsync).toHaveBeenCalledWith("auth_token", token);
    });
  });

  describe("removeAuthToken", () => {
    it("認証トークンを削除できること", async () => {
      // Act
      await removeAuthToken();

      // Assert
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("auth_token");
    });
  });

  describe("getRefreshToken", () => {
    it("保存済みのリフレッシュトークンを取得できること", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue("refresh-token");

      // Act
      const result = await getRefreshToken();

      // Assert
      expect(result).toBe("refresh-token");
      expect(mockGetItemAsync).toHaveBeenCalledWith("refresh_token");
    });

    it("リフレッシュトークンが存在しない場合nullを返すこと", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue(null);

      // Act
      const result = await getRefreshToken();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("setRefreshToken", () => {
    it("リフレッシュトークンを保存できること", async () => {
      // Arrange
      const token = "new-refresh-token";

      // Act
      await setRefreshToken(token);

      // Assert
      expect(mockSetItemAsync).toHaveBeenCalledWith("refresh_token", token);
    });
  });

  describe("removeRefreshToken", () => {
    it("リフレッシュトークンを削除できること", async () => {
      // Act
      await removeRefreshToken();

      // Assert
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("refresh_token");
    });
  });

  describe("clearAuthTokens", () => {
    it("認証トークンとリフレッシュトークンをまとめて削除できること", async () => {
      // Act
      await clearAuthTokens();

      // Assert
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("auth_token");
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("refresh_token");
      expect(mockDeleteItemAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe("setOAuthState", () => {
    it("OAuth stateを保存できること", async () => {
      // Arrange
      const state = "random-nonce-value";

      // Act
      await setOAuthState(state);

      // Assert
      expect(mockSetItemAsync).toHaveBeenCalledWith("oauth_state_nonce", state);
    });
  });

  describe("getOAuthState", () => {
    it("保存済みのOAuth stateを取得できること", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue("random-nonce-value");

      // Act
      const result = await getOAuthState();

      // Assert
      expect(result).toBe("random-nonce-value");
      expect(mockGetItemAsync).toHaveBeenCalledWith("oauth_state_nonce");
    });

    it("OAuth stateが存在しない場合nullを返すこと", async () => {
      // Arrange
      mockGetItemAsync.mockResolvedValue(null);

      // Act
      const result = await getOAuthState();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("removeOAuthState", () => {
    it("OAuth stateを削除できること", async () => {
      // Act
      await removeOAuthState();

      // Assert
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("oauth_state_nonce");
    });
  });
});
