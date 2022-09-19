const slowDown = require("../lib/express-slow-down");
const { expectDelay, expectNoDelay } = require("./helpers/requests");

describe("slowdown", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, "setTimeout");
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should not delay the first request", () => {
    const instance = slowDown({
      delayAfter: 1,
    });
    expectNoDelay(instance);
  });

  it("should delay the first request", () => {
    const instance = slowDown({
      delayAfter: 0,
      delayMs: 100,
    });
    expectDelay(instance, 100);
  });

  it("should apply a larger delay to each subsequent request", () => {
    const instance = slowDown({
      delayAfter: 0,
      delayMs: 100,
    });
    expectDelay(instance, 100);
    expectDelay(instance, 200);
    expectDelay(instance, 300);
  });

  it("should apply a cap of maxDelayMs on the the delay", () => {
    const instance = slowDown({
      delayAfter: 0,
      delayMs: 100,
      maxDelayMs: 250,
    });
    expectDelay(instance, 100);
    expectDelay(instance, 200);
    expectDelay(instance, 250);
    expectDelay(instance, 250);
    expectDelay(instance, 250);
    expectDelay(instance, 250);
  });

  it("should allow delayAfter requests before delaying", () => {
    const instance = slowDown({
      delayAfter: 2,
      delayMs: 300,
    });
    expectNoDelay(instance);
    expectNoDelay(instance);
    expectDelay(instance, 300);
  });

  it("should allow delayAfter to be a function", () => {
    const instance = slowDown({
      delayAfter: () => 2,
      delayMs: 99,
    });
    expectNoDelay(instance);
    expectNoDelay(instance);
    expectDelay(instance, 99);
  });

  it("should (eventually) return to full speed", () => {
    const instance = slowDown({
      delayMs: 100,
      delayAfter: 1,
      windowMs: 300,
    });
    expectNoDelay(instance);
    expectDelay(instance, 100);

    jest.advanceTimersByTime(200);
    setTimeout.mockClear();
    expectNoDelay(instance);
  });

  it("should work repeatedly (issues #2 & #3)", () => {
    const instance = slowDown({
      delayMs: 100,
      delayAfter: 2,
      windowMs: 50,
    });

    expectNoDelay(instance);
    expectNoDelay(instance);
    expectDelay(instance, 100); // note: window is reset twice in this time
    setTimeout.mockClear();
    expectNoDelay(instance);
    expectNoDelay(instance);
    expectDelay(instance, 100);
    setTimeout.mockClear();
    expectNoDelay(instance);
  });
});
