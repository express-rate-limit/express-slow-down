const slowDown = require("../source/express-slow-down");

describe("options", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should not modify the options object passed", () => {
    const options = {};
    slowDown(options);
    expect(options).toStrictEqual({});
  });
});
