const EventEmitter = require("events");
const slowDown = require("../lib/express-slow-down");
const { expectDelay, expectNoDelay } = require("./helpers/requests");
const { MockStore } = require("./helpers/mock-store");

describe("request skipping", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, "setTimeout");
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // skip

  it("should allow a custom skip function", async () => {
    const skip = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const instance = slowDown({
      delayAfter: 0,
      delayMs: 100,
      skip,
    });
    await expectDelay(instance, 100);
    expect(skip).toHaveBeenCalled();

    setTimeout.mockClear();
    await expectNoDelay(instance);
    expect(skip).toHaveBeenCalledTimes(2);
  });

  // skipSuccessfulRequests

  it("should decrement hits with success response and skipSuccessfulRequests", async () => {
    const req = {},
      res = new EventEmitter();
    jest.spyOn(res, "on");
    const store = new MockStore();
    const instance = slowDown({
      skipSuccessfulRequests: true,
      store,
    });
    await expectNoDelay(instance, req, res);
    expect(store.decrement_was_called).toBeFalsy();
    expect(res.on).toHaveBeenCalled();

    res.statusCode = 200;
    res.emit("finish");
    expect(store.decrement_was_called).toBeTruthy();
  });

  it("should not decrement hits with error response and skipSuccessfulRequests", async () => {
    const req = {},
      res = new EventEmitter();
    const store = new MockStore();
    const instance = slowDown({
      skipSuccessfulRequests: true,
      store,
    });
    await expectNoDelay(instance, req, res);

    res.statusCode = 400;
    res.emit("finish");
    expect(store.decrement_was_called).toBeFalsy();
  });

  // skipFailedRequests

  it("should not decrement hits with success response and skipFailedRequests", async () => {
    const req = {},
      res = new EventEmitter();
    jest.spyOn(res, "on");
    const store = new MockStore();
    const instance = slowDown({
      skipFailedRequests: true,
      store,
    });
    await expectNoDelay(instance, req, res);
    expect(res.on).toHaveBeenCalled();

    res.statusCode = 200;
    res.emit("finish");
    expect(store.decrement_was_called).toBeFalsy();
  });

  it("should decrement hits with error status code and skipFailedRequests", async () => {
    const req = {},
      res = new EventEmitter();
    const store = new MockStore();
    const instance = slowDown({
      skipFailedRequests: true,
      store,
    });
    await expectNoDelay(instance, req, res);
    expect(store.decrement_was_called).toBeFalsy();

    res.statusCode = 400;
    res.emit("finish");
    expect(store.decrement_was_called).toBeTruthy();
  });

  it("should decrement hits with closed unfinished response and skipFailedRequests", async () => {
    const req = {},
      res = new EventEmitter();
    const store = new MockStore();
    const instance = slowDown({
      skipFailedRequests: true,
      store,
    });
    await expectNoDelay(instance, req, res);
    expect(store.decrement_was_called).toBeFalsy();

    res.finished = false;
    res.emit("close");
    expect(store.decrement_was_called).toBeTruthy();
  });

  it("should decrement hits with error event on response and skipFailedRequests", async () => {
    const req = {},
      res = new EventEmitter();
    const store = new MockStore();
    const instance = slowDown({
      skipFailedRequests: true,
      store,
    });
    await expectNoDelay(instance, req, res);
    expect(store.decrement_was_called).toBeFalsy();

    res.emit("error");
    expect(store.decrement_was_called).toBeTruthy();
  });
});
