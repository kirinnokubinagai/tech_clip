import { parseGitHub } from "@api/services/parsers/github";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** GitHub REST API README正常レスポンスのモックデータ */
const SAMPLE_README_RESPONSE = {
  name: "README.md",
  path: "README.md",
  content: btoa(
    "# My Project\n\nThis is a sample project.\n\n## Features\n\n- Feature A\n- Feature B",
  ),
  encoding: "base64",
};

/** GitHub REST API Issue正常レスポンスのモックデータ */
const SAMPLE_ISSUE_RESPONSE = {
  number: 42,
  title: "Fix login bug",
  body: "## Description\n\nLogin fails when email contains a plus sign.",
  user: { login: "octocat" },
  created_at: "2024-07-01T12:00:00Z",
};

/** GitHub REST API Pull Request正常レスポンスのモックデータ */
const SAMPLE_PR_RESPONSE = {
  number: 99,
  title: "Add dark mode support",
  body: "## Summary\n\nImplements dark mode across the app.\n\n## Changes\n\n- Updated theme provider\n- Added toggle switch",
  user: { login: "contributor1" },
  created_at: "2024-08-15T09:30:00Z",
};

/** fetchのモック */
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseGitHub", () => {
  describe("URL検証", () => {
    it("GitHub以外のURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://example.com/article";

      // Act & Assert
      await expect(parseGitHub(url)).rejects.toThrow("GitHubのURLではありません");
    });

    it("owner/repoが含まれないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://github.com/";

      // Act & Assert
      await expect(parseGitHub(url)).rejects.toThrow("GitHubのURLからowner/repoを抽出できません");
    });

    it("ownerのみでrepoがないURLの場合エラーになること", async () => {
      // Arrange
      const url = "https://github.com/octocat";

      // Act & Assert
      await expect(parseGitHub(url)).rejects.toThrow("GitHubのURLからowner/repoを抽出できません");
    });
  });

  describe("リポジトリURL（README取得）", () => {
    it("リポジトリURLからREADMEのタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_README_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.title).toBe("octocat/hello-world");
    });

    it("READMEのBase64デコードされたMarkdownコンテンツを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_README_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.content).toContain("# My Project");
      expect(result.content).toContain("This is a sample project.");
    });

    it("正しいAPIエンドポイントにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_README_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world";

      // Act
      await parseGitHub(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/octocat/hello-world/readme",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.any(String),
            Accept: "application/vnd.github.v3+json",
          }),
        }),
      );
    });

    it("sourceが'github.com'であること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_README_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.source).toBe("github.com");
    });

    it("読了時間が1分以上で計算されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_README_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    });

    it("authorがnullであること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_README_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.author).toBeNull();
    });
  });

  describe("Issue URL", () => {
    it("Issue URLからタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_ISSUE_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/issues/42";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.title).toBe("Fix login bug");
    });

    it("Issue URLから本文を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_ISSUE_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/issues/42";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.content).toContain("Login fails when email contains a plus sign.");
    });

    it("Issue URLから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_ISSUE_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/issues/42";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.author).toBe("octocat");
    });

    it("Issue URLから公開日を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_ISSUE_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/issues/42";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.publishedAt).toBe("2024-07-01T12:00:00Z");
    });

    it("正しいIssues APIエンドポイントにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_ISSUE_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/issues/42";

      // Act
      await parseGitHub(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/octocat/hello-world/issues/42",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github.v3+json",
          }),
        }),
      );
    });
  });

  describe("Pull Request URL", () => {
    it("PR URLからタイトルを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_PR_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/pull/99";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.title).toBe("Add dark mode support");
    });

    it("PR URLから本文を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_PR_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/pull/99";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.content).toContain("Implements dark mode across the app.");
    });

    it("PR URLから著者名を取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_PR_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/pull/99";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.author).toBe("contributor1");
    });

    it("正しいPulls APIエンドポイントにリクエストすること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_PR_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/pull/99";

      // Act
      await parseGitHub(url);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/octocat/hello-world/pulls/99",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github.v3+json",
          }),
        }),
      );
    });
  });

  describe("bodyがnullの場合", () => {
    it("Issue bodyがnullの場合空文字列をcontentに設定すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...SAMPLE_ISSUE_RESPONSE, body: null }),
      });
      const url = "https://github.com/octocat/hello-world/issues/42";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.content).toBe("");
    });

    it("PR bodyがnullの場合空文字列をcontentに設定すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...SAMPLE_PR_RESPONSE, body: null }),
      });
      const url = "https://github.com/octocat/hello-world/pull/99";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.content).toBe("");
    });
  });

  describe("異常系", () => {
    it("README APIリクエストが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url = "https://github.com/octocat/hello-world";

      // Act & Assert
      await expect(parseGitHub(url)).rejects.toThrow("GitHub APIからのデータ取得に失敗しました");
    });

    it("Issue APIリクエストが失敗した場合エラーになること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      const url = "https://github.com/octocat/hello-world/issues/999";

      // Act & Assert
      await expect(parseGitHub(url)).rejects.toThrow("GitHub APIからのデータ取得に失敗しました");
    });

    it("ネットワークエラーの場合エラーになること", async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      const url = "https://github.com/octocat/hello-world";

      // Act & Assert
      await expect(parseGitHub(url)).rejects.toThrow();
    });
  });

  describe("URL形式バリエーション", () => {
    it("末尾にスラッシュがあるリポジトリURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_README_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.title).toBe("octocat/hello-world");
    });

    it("クエリパラメータ付きURLでもパースできること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_README_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world?tab=readme";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.title).toBe("octocat/hello-world");
    });

    it("treeパス付きリポジトリURLでもREADMEを取得できること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(SAMPLE_README_RESPONSE),
      });
      const url = "https://github.com/octocat/hello-world/tree/main";

      // Act
      const result = await parseGitHub(url);

      // Assert
      expect(result.title).toBe("octocat/hello-world");
    });
  });
});
