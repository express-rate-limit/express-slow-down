"use strict";
var express = require("express");
var assert = require("assert");
var request = require("supertest");
var slowDown = require("../lib/express-slow-down.js");

// todo: look into using http://sinonjs.org/docs/#clock instead of actually letting the tests wait on setTimeouts

describe("express-slow-down node module", function() {
  var start, delay, app, longResponseClosed;

  beforeEach(function() {
    start = Date.now();
    longResponseClosed = false;
  });

  afterEach(function() {
    delay = null;
  });

  function createAppWith(limit, checkVar, errorHandler, successHandler) {
    app = express();
    app.all("/", limit, function(req, res) {
      if (
        checkVar &&
        req.slowDown.current === 1 &&
        req.slowDown.remaining === 4
      ) {
        app.end(function(err, res) {
          if (err) {
            return errorHandler(err);
          }
          return successHandler(null, res);
        });
      }
      res.send("response!");
    });
    // helper endpoint to know what ip test requests come from
    // set in headers so that I don't have to deal with the body being a stream
    app.get("/ip", function(req, res) {
      res.setHeader("x-your-ip", req.ip);
      res.status(204).send("");
    });

    app.all("/bad_response_status", limit, function(req, res) {
      res.status(403).send();
    });
    app.all("/long_response", limit, function(req, res) {
      const timerId = setTimeout(() => res.send("response!"), 100);
      res.on("close", () => {
        longResponseClosed = true;
        clearTimeout(timerId);
      });
    });
    app.all("/response_emit_error", limit, function(req, res) {
      res.on("error", () => {
        res.end();
      });
      res.emit("error", new Error());
    });
    return app;
  }

  function InvalidStore() {}

  function MockStore() {
    this.incr_was_called = false;
    this.resetKey_was_called = false;
    this.decrement_was_called = false;
    this.counter = 0;

    this.incr = (key, cb) => {
      this.counter++;
      this.incr_was_called = true;

      cb(null, this.counter);
    };

    this.decrement = () => {
      this.counter--;
      this.decrement_was_called = true;
    };

    this.resetKey = () => {
      this.resetKey_was_called = true;
      this.counter = 0;
    };
  }

  function fastRequest(errorHandler, successHandler, key) {
    var req = request(app).get("/");
    // add optional key parameter
    if (key) {
      req = req.query({ key: key });
    }

    req
      .expect(200)
      .expect(/response!/)
      .end(function(err, res) {
        if (err) {
          return errorHandler(err);
        }
        delay = Date.now() - start;
        if (successHandler) {
          successHandler(null, res);
        }
      });
  }

  // for the moment, we're not checking the speed within the response. but this should make it easy to add that check later.
  const slowRequest = fastRequest;

  it("should not allow the use of a store that is not valid", function(done) {
    try {
      slowDown({
        store: new InvalidStore()
      });
    } catch (e) {
      return done();
    }

    done(new Error("It allowed an invalid store"));
  });

  it("should call incr on the store", function(done) {
    var store = new MockStore();

    createAppWith(
      slowDown({
        store: store
      })
    );

    fastRequest(done, function() {
      if (!store.incr_was_called) {
        done(new Error("incr was not called on the store"));
      } else {
        done();
      }
    });
  });

  it("should call resetKey on the store", function(done) {
    var store = new MockStore();
    var limiter = slowDown({
      store: store
    });

    limiter.resetKey("key");

    if (!store.resetKey_was_called) {
      done(new Error("resetKey was not called on the store"));
    } else {
      done();
    }
  });

  it("should allow the first request with minimal delay", function(done) {
    createAppWith(slowDown());
    fastRequest(done, function(/* err, res */) {
      delay = Date.now() - start;
      if (delay > 99) {
        done(new Error("First request took too long: " + delay + "ms"));
      } else {
        done();
      }
    });
  });

  it("should apply a small delay to the second request", function(done) {
    createAppWith(
      slowDown({
        delayMs: 100
      })
    );
    fastRequest(done, function(/* err, res */) {
      if (delay > 99) {
        done(new Error("First request took too long: " + delay + "ms"));
      }
    });
    fastRequest(done, function(/* err, res */) {
      if (delay < 100) {
        return done(
          new Error("Second request was served too fast: " + delay + "ms")
        );
      }
      if (delay > 199) {
        return done(new Error("Second request took too long: " + delay + "ms"));
      }
      done();
    });
  });

  it("should apply a larger delay to the subsequent request", function(done) {
    createAppWith(
      slowDown({
        delayMs: 100
      })
    );
    fastRequest(done);
    fastRequest(done);
    fastRequest(done);
    fastRequest(done, function(/* err, res */) {
      // should be about 300ms delay on 4th request - because the multiplier starts at 0
      if (delay < 300) {
        return done(
          new Error("Fourth request was served too fast: " + delay + "ms")
        );
      }
      if (delay > 400) {
        return done(new Error("Fourth request took too long: " + delay + "ms"));
      }
      done();
    });
  });

  it("should allow delayAfter requests before delaying responses", function(done) {
    createAppWith(
      slowDown({
        delayMs: 100,
        delayAfter: 2
      })
    );
    fastRequest(done, function(/* err, res */) {
      if (delay > 50) {
        done(new Error("First request took too long: " + delay + "ms"));
      }
    });
    fastRequest(done, function(/* err, res */) {
      if (delay > 100) {
        done(new Error("Second request took too long: " + delay + "ms"));
      }
    });
    fastRequest(done, function(/* err, res */) {
      if (delay < 100) {
        return done(
          new Error("Second request was served too fast: " + delay + "ms")
        );
      }
      if (delay > 150) {
        return done(new Error("Second request took too long: " + delay + "ms"));
      }
      done();
    });
  });

  it("should (eventually) return to full speed", function(done) {
    createAppWith(
      slowDown({
        delayMs: 100,
        max: 1,
        windowMs: 50
      })
    );
    fastRequest(done);
    fastRequest(done);
    slowRequest(done);
    setTimeout(function() {
      start = Date.now();
      fastRequest(done, function(/* err, res */) {
        if (delay > 50) {
          done(new Error("Eventual request took too long: " + delay + "ms"));
        } else {
          done();
        }
      });
    }, 500);
  });

  it("should work repeatedly (issues #2 & #3)", function(done) {
    createAppWith(
      slowDown({
        delayMs: 100,
        max: 2,
        windowMs: 50
      })
    );

    fastRequest(done);
    fastRequest(done);
    slowRequest(done);
    setTimeout(function() {
      start = Date.now();
      fastRequest(done, function(/* err, res */) {
        if (delay > 50) {
          done(new Error("Eventual request took too long: " + delay + "ms"));
        } else {
          fastRequest(done);
          slowRequest(done);
          setTimeout(function() {
            start = Date.now();
            fastRequest(done, function(/* err, res */) {
              if (delay > 50) {
                done(
                  new Error("Eventual request took too long: " + delay + "ms")
                );
              } else {
                done();
              }
            });
          }, 60);
        }
      });
    }, 60);
  });

  it("should allow individual IP's to be reset", function(done) {
    var limiter = slowDown({
      delayMs: 100,
      max: 1,
      windowMs: 50
    });
    createAppWith(limiter);

    request(app)
      .get("/ip")
      .expect(204)
      .end(function(err, res) {
        var myIp = res.headers["x-your-ip"];
        if (!myIp) {
          return done(new Error("unable to determine local IP"));
        }
        fastRequest(done);
        slowRequest(done, function(err) {
          if (err) {
            return done(err);
          }
          limiter.resetKey(myIp);
          fastRequest(done, done);
        });
      });
  });

  it("should allow custom key generators", function(done) {
    var limiter = slowDown({
      delayMs: 0,
      max: 2,
      keyGenerator: function(req, res) {
        assert.ok(req);
        assert.ok(res);

        var key = req.query.key;
        assert.ok(key);

        return key;
      }
    });

    createAppWith(limiter);
    fastRequest(done, null, 1);
    fastRequest(done, null, 1);
    fastRequest(done, null, 2);
    slowRequest(
      done,
      function(err) {
        if (err) {
          return done(err);
        }
        fastRequest(done, null, 2);
        slowRequest(done, done, 2);
      },
      1
    );
  });

  it("should allow custom skip function", function(done) {
    var limiter = slowDown({
      delayMs: 0,
      max: 2,
      skip: function(req, res) {
        assert.ok(req);
        assert.ok(res);

        return true;
      }
    });

    createAppWith(limiter);
    fastRequest(done, null, 1);
    fastRequest(done, null, 1);
    fastRequest(done, done, 1); // 3rd request would normally fail but we're skipping it
  });

  it("should pass current hits and remaining hits to the next function", function(done) {
    var limiter = slowDown({
      headers: false
    });
    createAppWith(limiter, true, done, done);
    done();
  });
  it("should decrement hits with success response and skipSuccessfulRequests", done => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipSuccessfulRequests: true,
        store: store
      })
    );
    fastRequest(done, function() {
      if (!store.decrement_was_called) {
        done(new Error("decrement was not called on the store"));
      } else {
        done();
      }
    });
  });
  it("should decrement hits with failed response and skipFailedRequests", done => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipFailedRequests: true,
        store: store
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
  it("should decrement hits with closed response and skipFailedRequests", done => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipFailedRequests: true,
        store: store
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
    request(app)
      .get("/long_response")
      .timeout({
        response: 10
      })
      .end(checkStoreDecremented);
  });
  it("should decrement hits with response emitting error and skipFailedRequests", done => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipFailedRequests: true,
        store: store
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

  it("should not decrement hits with success response and skipFailedRequests", done => {
    const store = new MockStore();
    createAppWith(
      slowDown({
        skipFailedRequests: true,
        store: store
      })
    );

    fastRequest(done, function() {
      if (store.decrement_was_called) {
        done(new Error("decrement was called on the store"));
      } else {
        done();
      }
    });
  });

  it("should decrement hits with a failure and skipFailedRequests", done => {
    const store = new MockStore();
    const app = createAppWith(
      slowDown({
        store: store,
        skipFailedRequests: true
      })
    );
    request(app)
      .get("/bad_response_status")
      .expect(403)
      .end(function(err /*, res*/) {
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
});
