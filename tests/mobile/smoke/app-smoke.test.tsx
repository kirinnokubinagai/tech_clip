import OnboardingScreen from "@mobile-app/onboarding";
import { render } from "@testing-library/react-native";

describe("mobile app smoke", () => {
  it("モジュールの読み込みと初期レンダーが例外なく完了すること", () => {
    expect(() => render(<OnboardingScreen />)).not.toThrow();
  });
});
