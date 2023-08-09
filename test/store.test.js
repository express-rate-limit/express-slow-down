const slowDown = require("../lib/express-slow-down");
const { MockStore, InvalidStore } = require("./helpers/mock-store");
const { MockStorePromiseBased } = require("./helpers/mock-store-promise-based");
const { expectNoDelay, expectNoDelayPromise } = require("./helpers/requests");

describe("store", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, "setTimeout");
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should not allow the use of a store that is not valid", async () => {
    expect(() => {
      slowDown({
        store: new InvalidStore(),
      });
    }).toThrowError(/store/i);
  });

  it("should call incr on the store", async () => {
    const store = new MockStore();
    expect(store.incr_was_called).toBeFalsy();

    const instance = slowDown({
      store,
    });
    await expectNoDelay(instance);
    expect(store.incr_was_called).toBeTruthy();
  });

  it("should call resetKey on the store", function () {
    const store = new MockStore();
    const limiter = slowDown({
      store,
    });
    limiter.resetKey("key");
    expect(store.resetKey_was_called).toBeTruthy();
  });

  describe("promise based", () => {
    it("should call increment on the store", async () => {
      const store = new MockStorePromiseBased();
      expect(store.incr_was_called).toBeFalsy();

      const instance = slowDown({ store });

      await expectNoDelayPromise(instance);
      expect(store.incr_was_called).toBeTruthy();
    });

    it("should call resetKey on the store", function () {
      const store = new MockStorePromiseBased();
      const limiter = slowDown({ store });
      limiter.resetKey("key");
      expect(store.resetKey_was_called).toBeTruthy();
    });
  });
});
