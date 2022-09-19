const slowDown = require("../lib/express-slow-down");
const { expectNoDelay } = require("./helpers/requests");

describe("req augmentation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, "setTimeout");
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should augment the req object with info about the slowdown status", () => {
    const req = {};
    const instance = slowDown({
      delayAfter: 1,
      windowMs: 1000,
    });
    expectNoDelay(instance, req);
    expect(req.slowDown).toMatchObject({
      current: 1,
      delay: 0,
      limit: 1,
      remaining: 0,
      // resetTime: Date object
    });
  });
});
