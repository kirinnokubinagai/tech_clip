module.exports = {
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  isInitialized: jest.fn(() => false),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setExtra: jest.fn(),
  withScope: jest.fn((cb) => cb({ setTag: jest.fn(), setExtra: jest.fn() })),
};
