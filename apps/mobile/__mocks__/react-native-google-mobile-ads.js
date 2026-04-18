const React = require("react");

module.exports = {
  BannerAd: () => null,
  BannerAdSize: {
    BANNER: "BANNER",
    LARGE_BANNER: "LARGE_BANNER",
    MEDIUM_RECTANGLE: "MEDIUM_RECTANGLE",
    FULL_BANNER: "FULL_BANNER",
    LEADERBOARD: "LEADERBOARD",
    ADAPTIVE_BANNER: "ADAPTIVE_BANNER",
    ANCHORED_ADAPTIVE_BANNER_PORTRAIT: "ANCHORED_ADAPTIVE_BANNER_PORTRAIT",
    ANCHORED_ADAPTIVE_BANNER_LANDSCAPE: "ANCHORED_ADAPTIVE_BANNER_LANDSCAPE",
  },
  TestIds: {
    BANNER: "test-banner-id",
    INTERSTITIAL: "test-interstitial-id",
    REWARDED: "test-rewarded-id",
    APP_OPEN: "test-app-open-id",
  },
  InterstitialAd: {
    createForAdRequest: jest.fn(() => ({
      addAdEventListener: jest.fn(() => jest.fn()),
      load: jest.fn(),
      show: jest.fn(),
    })),
  },
  AdEventType: {
    LOADED: "loaded",
    CLOSED: "closed",
    ERROR: "error",
    OPENED: "opened",
    CLICKED: "clicked",
  },
  MobileAds: jest.fn(() => ({
    initialize: jest.fn(() => Promise.resolve([])),
  })),
};
