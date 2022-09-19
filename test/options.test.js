const slowDown = require("../lib/express-slow-down");

describe("options", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.skip("should not modify the options object passed", () => {
    const options = {};
    slowDown(options);
    expect(options).toStrictEqual({});
  });
});
