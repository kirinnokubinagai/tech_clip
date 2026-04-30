import { isPublicHost, SsrfBlockedError, safeFetch } from "@api/lib/safe-fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isPublicHost", () => {
  describe("IP literal (IPv4)", () => {
    it("公開 IP 1.1.1.1 を許可すること", () => {
      expect(isPublicHost("http://1.1.1.1/path")).toBe(true);
    });

    it("公開 IP 8.8.8.8 を許可すること", () => {
      expect(isPublicHost("https://8.8.8.8/dns-query")).toBe(true);
    });

    it("0.0.0.0 を拒否すること", () => {
      expect(isPublicHost("http://0.0.0.0/path")).toBe(false);
    });

    it("0.255.255.255 (0.0.0.0/8) を拒否すること", () => {
      expect(isPublicHost("http://0.255.255.255/path")).toBe(false);
    });

    it("10.0.0.1 を拒否すること", () => {
      expect(isPublicHost("http://10.0.0.1/path")).toBe(false);
    });

    it("10.255.255.255 を拒否すること", () => {
      expect(isPublicHost("http://10.255.255.255/path")).toBe(false);
    });

    it("127.0.0.1 を拒否すること", () => {
      expect(isPublicHost("http://127.0.0.1/path")).toBe(false);
    });

    it("127.255.255.255 (loopback) を拒否すること", () => {
      expect(isPublicHost("http://127.255.255.255/path")).toBe(false);
    });

    it("100.64.0.1 (CGNAT) を拒否すること", () => {
      expect(isPublicHost("http://100.64.0.1/path")).toBe(false);
    });

    it("100.127.255.255 (CGNAT) を拒否すること", () => {
      expect(isPublicHost("http://100.127.255.255/path")).toBe(false);
    });

    it("169.254.169.254 (AWS metadata) を拒否すること", () => {
      expect(isPublicHost("http://169.254.169.254/latest/meta-data")).toBe(false);
    });

    it("169.254.0.1 (link-local) を拒否すること", () => {
      expect(isPublicHost("http://169.254.0.1/path")).toBe(false);
    });

    it("172.16.0.1 を拒否すること", () => {
      expect(isPublicHost("http://172.16.0.1/path")).toBe(false);
    });

    it("172.31.255.255 を拒否すること", () => {
      expect(isPublicHost("http://172.31.255.255/path")).toBe(false);
    });

    it("192.168.0.1 を拒否すること", () => {
      expect(isPublicHost("http://192.168.0.1/path")).toBe(false);
    });

    it("192.168.255.255 を拒否すること", () => {
      expect(isPublicHost("http://192.168.255.255/path")).toBe(false);
    });

    it("198.18.0.1 (benchmark) を拒否すること", () => {
      expect(isPublicHost("http://198.18.0.1/path")).toBe(false);
    });

    it("198.19.255.255 (benchmark) を拒否すること", () => {
      expect(isPublicHost("http://198.19.255.255/path")).toBe(false);
    });

    it("224.0.0.1 (multicast) を拒否すること", () => {
      expect(isPublicHost("http://224.0.0.1/path")).toBe(false);
    });

    it("239.255.255.255 (multicast) を拒否すること", () => {
      expect(isPublicHost("http://239.255.255.255/path")).toBe(false);
    });

    it("255.255.255.255 (broadcast/reserved) を拒否すること", () => {
      expect(isPublicHost("http://255.255.255.255/path")).toBe(false);
    });

    it("240.0.0.1 (reserved) を拒否すること", () => {
      expect(isPublicHost("http://240.0.0.1/path")).toBe(false);
    });

    it("192.0.2.1 (TEST-NET-1) を拒否すること", () => {
      expect(isPublicHost("http://192.0.2.1/path")).toBe(false);
    });

    it("192.88.99.1 (6to4 anycast) を拒否すること", () => {
      expect(isPublicHost("http://192.88.99.1/path")).toBe(false);
    });

    it("192.0.0.1 (IETF assignments) を拒否すること", () => {
      expect(isPublicHost("http://192.0.0.1/path")).toBe(false);
    });

    it("198.51.100.1 (TEST-NET-2) を拒否すること", () => {
      expect(isPublicHost("http://198.51.100.1/path")).toBe(false);
    });

    it("203.0.113.1 (TEST-NET-3) を拒否すること", () => {
      expect(isPublicHost("http://203.0.113.1/path")).toBe(false);
    });
  });

  describe("IP literal (IPv6)", () => {
    it("公開 IPv6 [2606:4700:4700::1111] を許可すること", () => {
      expect(isPublicHost("http://[2606:4700:4700::1111]/path")).toBe(true);
    });

    it("公開 IPv6 [2001:4860:4860::8888] を許可すること", () => {
      expect(isPublicHost("https://[2001:4860:4860::8888]/path")).toBe(true);
    });

    it("[3fff::1] (global unicast 上限) を許可すること", () => {
      expect(isPublicHost("http://[3fff::1]/path")).toBe(true);
    });

    it("[::] (unspecified) を拒否すること", () => {
      expect(isPublicHost("http://[::]/path")).toBe(false);
    });

    it("[::1] (loopback) を拒否すること", () => {
      expect(isPublicHost("http://[::1]/path")).toBe(false);
    });

    it("[fe80::1] (link-local) を拒否すること", () => {
      expect(isPublicHost("http://[fe80::1]/path")).toBe(false);
    });

    it("[fe80::abcd:1234] (link-local) を拒否すること", () => {
      expect(isPublicHost("http://[fe80::abcd:1234]/path")).toBe(false);
    });

    it("[fc00::1] (ULA) を拒否すること", () => {
      expect(isPublicHost("http://[fc00::1]/path")).toBe(false);
    });

    it("[fd12:3456::1] (ULA) を拒否すること", () => {
      expect(isPublicHost("http://[fd12:3456::1]/path")).toBe(false);
    });

    it("[ff02::1] (multicast) を拒否すること", () => {
      expect(isPublicHost("http://[ff02::1]/path")).toBe(false);
    });

    it("[ff00::1] (multicast) を拒否すること", () => {
      expect(isPublicHost("http://[ff00::1]/path")).toBe(false);
    });

    it("[2001:db8::1] (documentation) を拒否すること", () => {
      expect(isPublicHost("http://[2001:db8::1]/path")).toBe(false);
    });

    it("[0100::1] (discard prefix) を拒否すること", () => {
      expect(isPublicHost("http://[0100::1]/path")).toBe(false);
    });

    it("[::ffff:192.168.1.1] (IPv4-mapped private) を拒否すること", () => {
      expect(isPublicHost("http://[::ffff:192.168.1.1]/path")).toBe(false);
    });

    it("[::ffff:8.8.8.8] (IPv4-mapped public) も拒否すること", () => {
      // 簡素化方針: IPv4-mapped は一律 deny
      expect(isPublicHost("http://[::ffff:8.8.8.8]/path")).toBe(false);
    });

    it("[::ffff:0:0] (IPv4-mapped prefix) を拒否すること", () => {
      expect(isPublicHost("http://[::ffff:0:0]/path")).toBe(false);
    });

    it("[4000::1] (global unicast 範囲外) を拒否すること", () => {
      // 4000::/3 は 2000::/3 に該当しない (first16=0x4000, 上位3bit=010)
      expect(isPublicHost("http://[4000::1]/path")).toBe(false);
    });

    it("[1fff::1] (global unicast 未満) を拒否すること", () => {
      // 0x1fff < 0x2000
      expect(isPublicHost("http://[1fff::1]/path")).toBe(false);
    });
  });

  describe("ホスト名", () => {
    it("example.com を許可すること", () => {
      expect(isPublicHost("https://example.com/path")).toBe(true);
    });

    it("api.github.com を許可すること", () => {
      expect(isPublicHost("https://api.github.com/repos")).toBe(true);
    });

    it("www.google.com を許可すること", () => {
      expect(isPublicHost("https://www.google.com/")).toBe(true);
    });

    it("localhost を拒否すること", () => {
      expect(isPublicHost("http://localhost/path")).toBe(false);
    });

    it("LOCALHOST (大文字) を拒否すること", () => {
      expect(isPublicHost("http://LOCALHOST/path")).toBe(false);
    });

    it("metadata.google.internal を拒否すること", () => {
      expect(isPublicHost("http://metadata.google.internal/computeMetadata/v1")).toBe(false);
    });

    it("metadata.azure.com を拒否すること", () => {
      expect(isPublicHost("http://metadata.azure.com/metadata/instance")).toBe(false);
    });

    it("foo.internal を拒否すること", () => {
      expect(isPublicHost("http://foo.internal/path")).toBe(false);
    });

    it("app.corp.internal を拒否すること", () => {
      expect(isPublicHost("http://app.corp.internal/path")).toBe(false);
    });

    it("foo.local を拒否すること", () => {
      expect(isPublicHost("http://foo.local/path")).toBe(false);
    });

    it("foo.localhost を拒否すること", () => {
      expect(isPublicHost("http://foo.localhost/path")).toBe(false);
    });

    it("FOO.LOCAL (大文字) を拒否すること", () => {
      expect(isPublicHost("http://FOO.LOCAL/path")).toBe(false);
    });
  });

  describe("プロトコル / ポート", () => {
    it("http:// を許可すること", () => {
      expect(isPublicHost("http://example.com/path")).toBe(true);
    });

    it("https:// を許可すること", () => {
      expect(isPublicHost("https://example.com/path")).toBe(true);
    });

    it("ftp:// を拒否すること", () => {
      expect(isPublicHost("ftp://example.com/file")).toBe(false);
    });

    it("file:// を拒否すること", () => {
      expect(isPublicHost("file:///etc/passwd")).toBe(false);
    });

    it("javascript: を拒否すること", () => {
      expect(isPublicHost("javascript:alert(1)")).toBe(false);
    });

    it("http://example.com:8080 を拒否すること (default port 以外)", () => {
      expect(isPublicHost("http://example.com:8080/path")).toBe(false);
    });

    it("https://example.com:8443 を拒否すること (default port 以外)", () => {
      expect(isPublicHost("https://example.com:8443/path")).toBe(false);
    });

    it("http://example.com:80 を許可すること", () => {
      expect(isPublicHost("http://example.com:80/path")).toBe(true);
    });

    it("https://example.com:443 を許可すること", () => {
      expect(isPublicHost("https://example.com:443/path")).toBe(true);
    });

    it("https://example.com (port 省略) を許可すること", () => {
      expect(isPublicHost("https://example.com/path")).toBe(true);
    });

    it("http://example.com:5432 (PostgreSQL port) を拒否すること", () => {
      expect(isPublicHost("http://example.com:5432/db")).toBe(false);
    });
  });

  describe("不正入力", () => {
    it("URL parse 失敗時は false を返すこと", () => {
      expect(isPublicHost("not a url")).toBe(false);
    });

    it("空文字は false を返すこと", () => {
      expect(isPublicHost("")).toBe(false);
    });

    it("スキームなし URL は false を返すこと", () => {
      expect(isPublicHost("example.com/path")).toBe(false);
    });
  });
});

describe("safeFetch", () => {
  describe("正常系", () => {
    it("public URL を fetch すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}),
        text: vi.fn().mockResolvedValue("body"),
      });

      // Act
      const res = await safeFetch("https://example.com/api");

      // Assert
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(res.ok).toBe(true);
    });

    it("redirect: 'manual' を強制すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}),
      });

      // Act
      await safeFetch("https://example.com/api", { redirect: "follow" });

      // Assert
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(init.redirect).toBe("manual");
    });

    it("init オプションが fetch に渡されること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({}),
      });

      // Act
      await safeFetch("https://example.com/api", { headers: { "X-Custom": "value" } });

      // Assert
      const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect((init.headers as Record<string, string>)["X-Custom"]).toBe("value");
    });
  });

  describe("初回 URL の検証", () => {
    it("private IP に対して SsrfBlockedError を throw すること (reason=private_ip)", async () => {
      // Act & Assert
      const err = await safeFetch("http://192.168.1.1/path").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
      expect(err.reason).toBe("private_ip");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("AWS metadata IP に対して SsrfBlockedError を throw すること", async () => {
      // Act & Assert
      const err = await safeFetch("http://169.254.169.254/latest/meta-data").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
    });

    it("IPv6 private IP に対して SsrfBlockedError を throw すること", async () => {
      // Act & Assert
      const err = await safeFetch("http://[fe80::1]/path").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
      expect(err.reason).toBe("private_ip");
    });

    it("非 default port に対して SsrfBlockedError を throw すること (reason=non_default_port)", async () => {
      // Act & Assert
      const err = await safeFetch("http://example.com:8080/path").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
      expect(err.reason).toBe("non_default_port");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("非 http(s) に対して SsrfBlockedError を throw すること (reason=non_http)", async () => {
      // Act & Assert
      const err = await safeFetch("ftp://example.com/file").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
      expect(err.reason).toBe("non_http");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("private hostname に対して SsrfBlockedError を throw すること (reason=private_hostname)", async () => {
      // Act & Assert
      const err = await safeFetch("http://localhost/path").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
      expect(err.reason).toBe("private_hostname");
    });

    it("SsrfBlockedError が url プロパティを持つこと", async () => {
      // Act & Assert
      const err = await safeFetch("http://192.168.1.1/path").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
      expect(err.url).toBe("http://192.168.1.1/path");
    });
  });

  describe("redirect 検証", () => {
    it("302 → public URL は許可すること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 302,
          headers: new Headers({ Location: "https://example.com/final" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({}),
        });

      // Act
      const res = await safeFetch("https://example.com/redirect");

      // Assert
      expect(res.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("302 → private IP は SsrfBlockedError (reason=private_ip)", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ Location: "http://169.254.169.254/latest/meta-data/" }),
      });

      // Act & Assert
      const err = await safeFetch("https://example.com/redirect").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
      expect(err.reason).toBe("private_ip");
    });

    it("301 もリダイレクト検証すること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 301,
          headers: new Headers({ Location: "https://example.com/final" }),
        })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({}) });

      // Act
      const res = await safeFetch("https://example.com/old");

      // Assert
      expect(res.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("303 もリダイレクト検証すること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 303,
          headers: new Headers({ Location: "https://example.com/final" }),
        })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({}) });

      // Act
      const res = await safeFetch("https://example.com/post");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(res.ok).toBe(true);
    });

    it("307 もリダイレクト検証すること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 307,
          headers: new Headers({ Location: "https://example.com/final" }),
        })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({}) });

      // Act
      const res = await safeFetch("https://example.com/temp");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(res.ok).toBe(true);
    });

    it("308 もリダイレクト検証すること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 308,
          headers: new Headers({ Location: "https://example.com/perm" }),
        })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({}) });

      // Act
      const res = await safeFetch("https://example.com/old");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(res.ok).toBe(true);
    });

    it("Location ヘッダ無しの 3xx はそのまま返すこと", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({}),
      });

      // Act
      const res = await safeFetch("https://example.com/redirect");

      // Assert
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(res.status).toBe(302);
    });

    it("相対 URL の Location を base URL で解決して検証すること", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 302,
          headers: new Headers({ Location: "/final-page" }),
        })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({}) });

      // Act
      const res = await safeFetch("https://example.com/redirect");

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondCall = mockFetch.mock.calls[1] as [string];
      expect(secondCall[0]).toBe("https://example.com/final-page");
      expect(res.ok).toBe(true);
    });

    it("ホップ数 5 を超えたら SsrfBlockedError (reason=redirect_loop) を throw すること", async () => {
      // Arrange
      const redirectResponse = {
        ok: false,
        status: 302,
        headers: new Headers({ Location: "https://example.com/hop" }),
      };
      for (let i = 0; i < 6; i++) {
        mockFetch.mockResolvedValueOnce(redirectResponse);
      }

      // Act & Assert
      const err = await safeFetch("https://example.com/start").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
      expect(err.reason).toBe("redirect_loop");
    });

    it("maxRedirects オプションで上限を変更できること", async () => {
      // Arrange - 3 hops, maxRedirects=2 → should fail
      const redirectResponse = {
        ok: false,
        status: 302,
        headers: new Headers({ Location: "https://example.com/hop" }),
      };
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce(redirectResponse);
      }

      // Act & Assert
      const err = await safeFetch("https://example.com/start", {}, { maxRedirects: 2 }).catch(
        (e) => e,
      );
      expect(err).toBeInstanceOf(SsrfBlockedError);
      expect(err.reason).toBe("redirect_loop");
    });

    it("302 → 非 http プロトコルは SsrfBlockedError を throw すること", async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 302,
        headers: new Headers({ Location: "ftp://example.com/file" }),
      });

      // Act & Assert
      const err = await safeFetch("https://example.com/redirect").catch((e) => e);
      expect(err).toBeInstanceOf(SsrfBlockedError);
    });
  });

  describe("ロギング", () => {
    it("ブロック時に warn ログを出すこと（query string は含めない）", async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Act
      await safeFetch("http://192.168.1.1/path?secret=token").catch(() => {});

      // Assert
      const logCalls = consoleSpy.mock.calls.map((args) => JSON.parse(args[0] as string));
      const warnLog = logCalls.find((l) => l.level === "warn");
      expect(warnLog).toBeDefined();
      expect(warnLog.url).not.toContain("secret=token");
      expect(warnLog.reason).toBeDefined();

      consoleSpy.mockRestore();
    });
  });
});
