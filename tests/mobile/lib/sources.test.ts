import { getSourceDefinition, SOURCE_DEFINITIONS } from "@/lib/sources";

describe("SOURCE_DEFINITIONS", () => {
  it("youtubeが含まれていること", () => {
    // Arrange
    const ids = SOURCE_DEFINITIONS.map(({ id }) => id);

    // Act / Assert
    expect(ids).toContain("youtube");
  });

  it("各定義にid・label・badgeClassNameが含まれていること", () => {
    for (const def of SOURCE_DEFINITIONS) {
      // Assert
      expect(def.id).toBeDefined();
      expect(def.label).toBeDefined();
      expect(def.badgeClassName).toBeDefined();
    }
  });
});

describe("getSourceDefinition", () => {
  it("youtubeを渡したときyoutube定義を返すこと", () => {
    // Act
    const result = getSourceDefinition("youtube");

    // Assert
    expect(result.id).toBe("youtube");
    expect(result.label).toBe("YouTube");
  });

  it("youtubeを渡したときotherにフォールバックしないこと", () => {
    // Act
    const result = getSourceDefinition("youtube");

    // Assert
    expect(result.id).not.toBe("other");
  });
});
