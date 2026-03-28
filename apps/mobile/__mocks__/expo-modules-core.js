/** expo-modules-coreのモック */
const EventEmitter = class {
  addListener() {}
  removeListener() {}
  emit() {}
};

module.exports = {
  EventEmitter,
  NativeModulesProxy: {},
  requireNativeModule: () => ({}),
  requireOptionalNativeModule: () => null,
  Platform: { OS: "ios" },
};
