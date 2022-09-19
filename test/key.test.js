const slowDown = require("../lib/express-slow-down");
const { expectDelay, expectNoDelay } = require("./helpers/requests");

describe("key", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, "setTimeout");
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should allow individual IP's to be reset", () => {
    const instance = slowDown({
      delayMs: 100,
      delayAfter: 1,
      windowMs: 1000,
    });

    const ip = "1.2.3.4";

    expectNoDelay(instance, { ip });
    expectDelay(instance, 100, { ip });

    instance.resetKey(ip);
    setTimeout.mockClear();

    expectNoDelay(instance, { ip });
  });

  it("should allow a custom key generator", () => {
    const keyGenerator = jest.fn();
    const instance = slowDown({
      delayAfter: 1,
      keyGenerator,
    });

    expectNoDelay(instance);
    expect(keyGenerator).toHaveBeenCalled();
  });
});
