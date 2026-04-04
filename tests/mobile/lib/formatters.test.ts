import { formatCompactNumber, formatRelativeTime, truncateText } from "@mobile/utils/formatters";

describe("formatRelativeTime", () => {
  describe("秒単位", () => {
    it("数秒前と表示されること", () => {
      // Arrange
      const now = new Date();
      const fiveSecondsAgo = new Date(now.getTime() - 5 * 1000);

      // Act
      const result = formatRelativeTime(fiveSecondsAgo, now);

      // Assert
      expect(result).toBe("たった今");
    });

    it("59秒前でもたった今と表示されること", () => {
      // Arrange
      const now = new Date();
      const fiftyNineSecondsAgo = new Date(now.getTime() - 59 * 1000);

      // Act
      const result = formatRelativeTime(fiftyNineSecondsAgo, now);

      // Assert
      expect(result).toBe("たった今");
    });
  });

  describe("分単位", () => {
    it("1分前と表示されること", () => {
      // Arrange
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      // Act
      const result = formatRelativeTime(oneMinuteAgo, now);

      // Assert
      expect(result).toBe("1分前");
    });

    it("30分前と表示されること", () => {
      // Arrange
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      // Act
      const result = formatRelativeTime(thirtyMinutesAgo, now);

      // Assert
      expect(result).toBe("30分前");
    });

    it("59分前と表示されること", () => {
      // Arrange
      const now = new Date();
      const fiftyNineMinutesAgo = new Date(now.getTime() - 59 * 60 * 1000);

      // Act
      const result = formatRelativeTime(fiftyNineMinutesAgo, now);

      // Assert
      expect(result).toBe("59分前");
    });
  });

  describe("時間単位", () => {
    it("1時間前と表示されること", () => {
      // Arrange
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(oneHourAgo, now);

      // Assert
      expect(result).toBe("1時間前");
    });

    it("3時間前と表示されること", () => {
      // Arrange
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(threeHoursAgo, now);

      // Assert
      expect(result).toBe("3時間前");
    });

    it("23時間前と表示されること", () => {
      // Arrange
      const now = new Date();
      const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(twentyThreeHoursAgo, now);

      // Assert
      expect(result).toBe("23時間前");
    });
  });

  describe("日単位", () => {
    it("1日前と表示されること", () => {
      // Arrange
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(oneDayAgo, now);

      // Assert
      expect(result).toBe("1日前");
    });

    it("6日前と表示されること", () => {
      // Arrange
      const now = new Date();
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(sixDaysAgo, now);

      // Assert
      expect(result).toBe("6日前");
    });
  });

  describe("週単位", () => {
    it("1週間前と表示されること", () => {
      // Arrange
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(oneWeekAgo, now);

      // Assert
      expect(result).toBe("1週間前");
    });

    it("3週間前と表示されること", () => {
      // Arrange
      const now = new Date();
      const threeWeeksAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(threeWeeksAgo, now);

      // Assert
      expect(result).toBe("3週間前");
    });
  });

  describe("月単位", () => {
    it("1ヶ月前と表示されること", () => {
      // Arrange
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(oneMonthAgo, now);

      // Assert
      expect(result).toBe("1ヶ月前");
    });

    it("11ヶ月前と表示されること", () => {
      // Arrange
      const now = new Date();
      const elevenMonthsAgo = new Date(now.getTime() - 335 * 24 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(elevenMonthsAgo, now);

      // Assert
      expect(result).toBe("11ヶ月前");
    });
  });

  describe("年単位", () => {
    it("1年前と表示されること", () => {
      // Arrange
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(oneYearAgo, now);

      // Assert
      expect(result).toBe("1年前");
    });

    it("3年前と表示されること", () => {
      // Arrange
      const now = new Date();
      const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000);

      // Act
      const result = formatRelativeTime(threeYearsAgo, now);

      // Assert
      expect(result).toBe("3年前");
    });
  });

  describe("Date文字列入力", () => {
    it("ISO文字列を受け付けること", () => {
      // Arrange
      const now = new Date("2024-01-01T12:00:00Z");
      const past = "2024-01-01T11:00:00Z";

      // Act
      const result = formatRelativeTime(past, now);

      // Assert
      expect(result).toBe("1時間前");
    });
  });

  describe("nowパラメータ省略", () => {
    it("nowを省略した場合は現在時刻が使われること", () => {
      // Arrange
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Act
      const result = formatRelativeTime(fiveMinutesAgo);

      // Assert
      expect(result).toBe("5分前");
    });
  });
});

describe("truncateText", () => {
  describe("正常系", () => {
    it("maxLength以下のテキストはそのまま返すこと", () => {
      // Arrange
      const text = "短いテキスト";

      // Act
      const result = truncateText(text, 20);

      // Assert
      expect(result).toBe("短いテキスト");
    });

    it("maxLengthを超えるテキストを切り詰めて省略記号を付与すること", () => {
      // Arrange
      const text = "これは非常に長いテキストです。切り詰める必要があります。";

      // Act
      const result = truncateText(text, 10);

      // Assert
      expect(result).toBe("これは非常に長いテキ...");
    });

    it("maxLengthちょうどのテキストはそのまま返すこと", () => {
      // Arrange
      const text = "12345";

      // Act
      const result = truncateText(text, 5);

      // Assert
      expect(result).toBe("12345");
    });
  });

  describe("カスタム省略記号", () => {
    it("カスタム省略記号を使用できること", () => {
      // Arrange
      const text = "これは長いテキストです";

      // Act
      const result = truncateText(text, 5, "---");

      // Assert
      expect(result).toBe("これは長いテ---");
    });
  });

  describe("境界値", () => {
    it("空文字列はそのまま返すこと", () => {
      // Arrange
      const text = "";

      // Act
      const result = truncateText(text, 10);

      // Assert
      expect(result).toBe("");
    });

    it("maxLengthが1の場合に正しく切り詰めること", () => {
      // Arrange
      const text = "テスト";

      // Act
      const result = truncateText(text, 1);

      // Assert
      expect(result).toBe("テ...");
    });
  });
});

describe("formatCompactNumber", () => {
  describe("千未満", () => {
    it("0はそのまま表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(0);

      // Assert
      expect(result).toBe("0");
    });

    it("999はそのまま表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(999);

      // Assert
      expect(result).toBe("999");
    });

    it("100はそのまま表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(100);

      // Assert
      expect(result).toBe("100");
    });
  });

  describe("千以上・万未満", () => {
    it("1000は1kと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(1000);

      // Assert
      expect(result).toBe("1k");
    });

    it("1500は1.5kと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(1500);

      // Assert
      expect(result).toBe("1.5k");
    });

    it("1234は1.2kと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(1234);

      // Assert
      expect(result).toBe("1.2k");
    });

    it("9999は10kと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(9999);

      // Assert
      expect(result).toBe("10k");
    });
  });

  describe("万以上・百万未満", () => {
    it("10000は10kと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(10000);

      // Assert
      expect(result).toBe("10k");
    });

    it("15000は15kと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(15000);

      // Assert
      expect(result).toBe("15k");
    });

    it("100000は100kと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(100000);

      // Assert
      expect(result).toBe("100k");
    });

    it("999999は1Mと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(999999);

      // Assert
      expect(result).toBe("1M");
    });
  });

  describe("百万以上", () => {
    it("1000000は1Mと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(1000000);

      // Assert
      expect(result).toBe("1M");
    });

    it("1500000は1.5Mと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(1500000);

      // Assert
      expect(result).toBe("1.5M");
    });

    it("1234567は1.2Mと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(1234567);

      // Assert
      expect(result).toBe("1.2M");
    });
  });

  describe("小数点の丸め", () => {
    it("1050は1.1kと表示されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(1050);

      // Assert
      expect(result).toBe("1.1k");
    });

    it("末尾の.0は省略されること", () => {
      // Arrange & Act
      const result = formatCompactNumber(2000);

      // Assert
      expect(result).toBe("2k");
    });
  });

  describe("負の数", () => {
    it("負の数も正しくフォーマットされること", () => {
      // Arrange & Act
      const result = formatCompactNumber(-1500);

      // Assert
      expect(result).toBe("-1.5k");
    });
  });
});
