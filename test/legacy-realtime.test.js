"use strict";
const express = require("express");
const assert = require("assert");
const request = require("supertest");
const eventEmitter = require("events");
const slowDown = require("../source/express-slow-down");
const { MockStore, InvalidStore } = require("./helpers/mock-store");

// todo: look into using http://sinonjs.org/docs/#clock instead of actually letting the tests wait on setTimeouts

describe("legacy realtime tests", function () {
  let app, longResponseClosed;

  beforeEach(function () {
    longResponseClosed = false;
  });

  function createAppWith(limit) {
    app = express();
    app.all("/", limit, function (req, res) {
      res.send("response!");
    });
    // helper endpoint to know what ip test requests come from
    // set in headers so that I don't have to deal with the body being a stream
    app.get("/ip", function (req, res) {
      res.setHeader("x-your-ip", req.ip);
      res.status(204).send("");
    });

    app.all("/bad_response_status", limit, function (req, res) {
      res.status(403).send();
    });
    app.all("/long_response", limit, function (req, res) {
      const timerId = setTimeout(() => res.send("response!"), 100);
      res.on("close", () => {
        longResponseClosed = true;

        clearTimeout(timerId);
      });
    });
    app.all("/response_emit_error", limit, function (req, res) {
      res.on("error", () => {
        res.end();
      });
      res.emit("error", new Error());
    });
    return app;
  }

  function fastRequest(errorHandler, successHandler, key) {
    let req = request(app).get("/");
    // add optional key parameter
    if (key) {
      req = req.query({ key: key });
    }

    req
      .expect(200)
      .expect(/response!/)
      .end(function (err, res) {
        if (err) {
          return errorHandler(err);
        }
        if (successHandler) {
          successHandler(null, res);
        }
      });
  }

  // for the moment, we're not checking the speed within the response. but this should make it easy to add that check later.
  const slowRequest = fastRequest;

  async function timedRequest() {
    const start = Date.now();
    await request(app)
      .get("/")
      .expect(200)
      .expect(/response!/);
    return Date.now() - start;
  }

  function sleep(t) {
    return new Promise((resolve) => setTimeout(resolve, t));
  }

  it("should not allow the use of a store that is not valid", function (done) {
    try {
      slowDown({
        store: new InvalidStore(),
      });
    } catch (e) {
      return done();
    }

    done(new Error("It allowed an invalid store"));
  });

  it("should call incr on the store", async () => {
    const store = new MockStore();
    assert(!store.incr_was_called);

    createAppWith(
      slowDown({
        store,
        validate: false,
      })
    );

    await request(app).get("/");
    assert(store.incr_was_called);
  });

  it("should call resetKey on the store", function () {
    const store = new MockStore();
    const limiter = slowDown({
      store,
      validate: false,
    });
    limiter.resetKey("key");
    assert(store.resetKey_was_called);
  });

  it("should allow the first request with minimal delay", async function () {
    createAppWith(slowDown({ validate: false }));
    const delay = await timedRequest();
    assert(delay < 100, "First request took too long: " + delay + "ms");
  });

  it("should apply a small delay to the second request", async function () {
    createAppWith(
      slowDown({
        delayMs: 100,
        validate: false,
      })
    );
    let delay = await timedRequest();
    assert(delay < 100, "First request took too long: " + delay + "ms");
    delay = await timedRequest();
    assert(delay >= 100, "Second request was served too fast: " + delay + "ms");
    // macos CI server is slow, and can add a 100-200ms of extra delay
    assert(delay < 400, "Second request took too long: " + delay + "ms");
  });

  it("should apply a larger delay to the subsequent request", async function () {
    createAppWith(
      slowDown({
        delayMs: 100,
        validate: false,
      })
    );
    await Promise.all([
      request(app).get("/"), // no delay
      request(app).get("/"), // 100ms delay
      request(app).get("/"), // 200ms delay
    ]);
    const delay = await timedRequest();
    // should be about 300ms delay on 4th request - because the multiplier starts at 0
    // BUT, this test frequently fails with a delay in the 4-500ms range on CI.
    // So, loosening up the range a bit here.
    assert(
      250 <= delay <= 600,
      "Fourth request was served too fast or slow: " + delay + "ms"
    );
  });

  it("should apply a cap of maxDelayMs on the the delay", async function () {
    createAppWith(
      slowDown({
        delayAfter: 1,
        delayMs: (used) => (used - 1) * 100,
        maxDelayMs: 200,
        validate: false,
      })
    );
    await Promise.all([
      request(app).get("/"), // 1st - no delay
      request(app).get("/"), // 2nd - 100ms delay
      request(app).get("/"), // 3rd - 200ms delay
    ]);

    const delay = await timedRequest();

    // should cap the delay so the 4th request delays about 200ms instead of 300ms
    // this one also likes to fail with too much delay on macOS in CI
    assert(delay >= 150, "Fourth request was served too fast: " + delay + "ms");
    assert(delay < 600, "Fourth request took too long: " + delay + "ms");
  });

  it("should allow delayAfter requests before delaying responses", async function () {
    createAppWith(
      slowDown({
        delayMs: 100,
        delayAfter: 2,
        validate: false,
      })
    );
    let delay = await timedRequest();
    assert(delay < 50, "First request took too long: " + delay + "ms");

    delay = await timedRequest();
    assert(delay < 50, "Second request took too long: " + delay + "ms");

    delay = await timedRequest();
    assert(50 < delay < 150, "Third request outside of range: " + delay + "ms");
  });

  it("should allow delayAfter to be a function", async function () {
    createAppWith(
      slowDown({
        delayMs: 100,
        delayAfter: () => 2,
        validate: false,
      })
    );
    let delay = await timedRequest();
    assert(delay < 50, "First request took too long: " + delay + "ms");

    delay = await timedRequest();
    assert(delay < 50, "Second request took too long: " + delay + "ms");

    delay = await timedRequest();
    assert(50 < delay < 150, "Third request outside of range: " + delay + "ms");
  });

  it("should (eventually) return to full speed", async function () {
    createAppWith(
      slowDown({
        delayMs: 100,
        delayAfter: 1,
        windowMs: 50,
        validate: false,
      })
    );
    await Promise.all([
      request(app).get("/"), // 1st - no delay
      request(app).get("/"), // 2nd - 100ms delay
      request(app).get("/"), // 3rd - 200ms delay
    ]);

    await sleep(500);

    const delay = await timedRequest();
    assert(delay < 50, "Fourth request took too long: " + delay + "ms");
  });

  it("should work repeatedly (issues #2 & #3)", async function () {
    createAppWith(
      slowDown({
        delayMs: 100,
        delayAfter: 2,
        windowMs: 50,
        validate: false,
      })
    );

    await Promise.all([
      request(app).get("/"), // 1st - no delay
      request(app).get("/"), // 2nd - 100ms delay
      request(app).get("/"), // 3rd - 200ms delay
    ]);

    await sleep(60);

    let delay = await timedRequest();
    assert(delay < 50, "Fourth request took too long: " + delay + "ms");

    await Promise.all([
      request(app).get("/"), // 1st - no delay
      request(app).get("/"), // 2nd - 100ms delay
    ]);

    await sleep(60);

    delay = await timedRequest();
    assert(delay < 50, "Eventual request took too long: " + delay + "ms");
  });

  it("should allow individual IP's to be reset", function (done) {
    const limiter = slowDown({
      delayMs: 100,
      delayAfter: 1,
      windowMs: 50,
      validate: false,
    });
    createAppWith(limiter);

    request(app)
      .get("/ip")
      .expect(204)
      .end(function (err, res) {
        const myIp = res.headers["x-your-ip"];
        if (!myIp) {
          return done(new Error("unable to determine local IP"));
        }
        fastRequest(done);
        slowRequest(done, function (err) {
          if (err) {
            return done(err);
          }
          limiter.resetKey(myIp);
          fastRequest(done, done);
        });
      });
  });

  it("should allow custom key generators", function (done) {
    const limiter = slowDown({
      delayMs: 0,
      delayAfter: 2,
      keyGenerator: function (req, res) {
        assert.ok(req);
        assert.ok(res);

        const { key } = req.query;
        assert.ok(key);

        return key;
      },
      validate: false,
    });

    createAppWith(limiter);
    fastRequest(done, null, 1);
    fastRequest(done, null, 1);
    fastRequest(done, null, 2);
    slowRequest(
      done,
      function (err) {
        if (err) {
          return done(err);
        }
        fastRequest(done, null, 2);
        slowRequest(done, done, 2);
      },
      1
    );
  });

  it("should allow custom skip function", function (done) {
    const limiter = slowDown({
      delayMs: 0,
      delayAfter: 2,
      skip: function (req, res) {
        assert.ok(req);
        assert.ok(res);

        return true;
      },
      validate: false,
    });

    createAppWith(limiter);
    fastRequest(done, null, 1);
    fastRequest(done, null, 1);
    fastRequest(done, done, 1); // 3rd request would normally fail but we're skipping it
  });

  it("should pass current hits and remaining hits to the next function", function (done) {
    const limiter = slowDown({
      headers: false,
      validate: false,
    });
    createAppWith(limiter, true, done, done);
    done();
  });
  it("should decrement hits with success response and skipSuccessfulRequests", (done) => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipSuccessfulRequests: true,
        store,
        validate: false,
      })
    );
    fastRequest(done, function () {
      if (!store.decrement_was_called) {
        done(new Error("decrement was not called on the store"));
      } else {
        done();
      }
    });
  });
  it("should decrement hits with failed response and skipFailedRequests", (done) => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipFailedRequests: true,
        store,
        validate: false,
      })
    );
    request(app)
      .get("/bad_response_status")
      .expect(403)
      .end(() => {
        if (!store.decrement_was_called) {
          done(new Error("decrement was not called on the store"));
        } else {
          done();
        }
      });
  });
  //after upgrading super test, this one always fails, because res.finished is set to true, despite the response never actually being sent
  // skip.test.js has an equivalent test hat doesn't use supertest and passes
  it.skip("should decrement hits with closed response and skipFailedRequests", (done) => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipFailedRequests: true,
        store,
        validate: false,
      })
    );
    const checkStoreDecremented = () => {
      if (longResponseClosed) {
        if (!store.decrement_was_called) {
          done(new Error("decrement was not called on the store"));
        } else {
          done();
        }
      } else {
        setImmediate(checkStoreDecremented);
      }
    };
    request(app).get("/long_response").timeout(10).end(checkStoreDecremented);
  });
  it("should decrement hits with response emitting error and skipFailedRequests", (done) => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipFailedRequests: true,
        store,
        validate: false,
      })
    );
    request(app)
      .get("/response_emit_error")
      .end(() => {
        if (!store.decrement_was_called) {
          done(new Error("decrement was not called on the store"));
        } else {
          done();
        }
      });
  });

  it("should not decrement hits with success response and skipFailedRequests", (done) => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipFailedRequests: true,
        store,
        validate: false,
      })
    );

    fastRequest(done, function () {
      if (store.decrement_was_called) {
        done(new Error("decrement was called on the store"));
      } else {
        done();
      }
    });
  });

  it("should decrement hits with a failure and skipFailedRequests", (done) => {
    const store = new MockStore();
    const app = createAppWith(
      slowDown({
        store,
        skipFailedRequests: true,
        validate: false,
      })
    );
    request(app)
      .get("/bad_response_status")
      .expect(403)
      .end(function (err /*, res*/) {
        if (err) {
          return done(err);
        }
        if (!store.decrement_was_called) {
          done(new Error("decrement was not called on the store"));
        } else {
          done();
        }
      });
  });

  it("should not excute slow down timer in case of req closed during delay", async () => {
    const reqMock = {};
    const resMock = new eventEmitter();
    const currentLimiterMiddleWare = slowDown({
      delayAfter: 0,
      delayMs: 100,
      windowMs: 1000,
      validate: false,
    });
    function next() {
      throw new Error("setTimeout should not excute!");
    }
    await currentLimiterMiddleWare(reqMock, resMock, next);
    resMock.emit("close");

    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  // todo: it("should not excute slow down timer in case of req closed before delay begins", async () => {
});
