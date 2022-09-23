"use strict";
const defaults = require("defaults");
const MemoryStore = require("./memory-store");

function SlowDown(options) {
  options = defaults(options, {
    // window, delay, and max apply per-key unless global is set to true
    windowMs: 60 * 1000, // milliseconds - how long to keep records of requests in memory
    delayAfter: 1, // how many requests to allow through before starting to delay responses
    delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits for the same key.
    maxDelayMs: Infinity, // milliseconds - maximum delay to be applied to the response, regardless the request count. Infinity means that the delay will grow continuously and unboundedly
    skipFailedRequests: false, // Do not count failed requests (status >= 400)
    skipSuccessfulRequests: false, // Do not count successful requests (status < 400)
    headers: false, //Send custom delay limit header with limit and remaining
    // allows to create custom keys (by default user IP is used)
    keyGenerator: function (req /*, res*/) {
      return req.ip;
    },
    skip: function (/*req, res*/) {
      return false;
    },
    onLimitReached: function (/*req, res, optionsUsed*/) {},
  });

  // store to use for persisting rate limit data
  options.store = options.store || new MemoryStore(options.windowMs);

  // ensure that the store has the incr method
  if (
    typeof options.store.incr !== "function" ||
    typeof options.store.resetKey !== "function" ||
    (options.skipFailedRequests &&
      typeof options.store.decrement !== "function")
  ) {
    throw new Error("The store is not valid.");
  }

  function slowDown(req, res, next) {
    if (options.skip(req, res)) {
      return next();
    }

    const key = options.keyGenerator(req, res);

    options.store.incr(key, function (err, current, resetTime) {
      if (err) {
        return next(err);
      }

      let delay = 0;

      const delayAfter =
        typeof options.delayAfter === "function"
          ? options.delayAfter(req, res)
          : options.delayAfter;

      const delayMs =
        typeof options.delayMs === "function"
          ? options.delayMs(req, res)
          : options.delayMs;

      const maxDelayMs =
        typeof options.maxDelayMs === "function"
          ? options.maxDelayMs(req, res)
          : options.maxDelayMs;

      if (current > delayAfter) {
        const unboundedDelay = (current - delayAfter) * delayMs;
        delay = Math.min(unboundedDelay, maxDelayMs);
      }

      req.slowDown = {
        limit: delayAfter,
        current: current,
        remaining: Math.max(delayAfter - current, 0),
        resetTime: resetTime,
        delay: delay,
      };
      if (options.headers && !res.headersSent) {
        res.setHeader("X-SlowDown-Limit", req.slowDown.limit);
        res.setHeader("X-SlowDown-Remaining", req.slowDown.remaining);
        if (resetTime instanceof Date) {
          // if we have a resetTime, also provide the current date to help avoid issues with incorrect clocks
          res.setHeader("Date", new Date().toGMTString());
          res.setHeader(
            "X-SlowDown-Reset",
            Math.ceil(resetTime.getTime() / 1000)
          );
        }
      }
      if (current - 1 === delayAfter) {
        options.onLimitReached(req, res, options);
      }

      if (options.skipFailedRequests || options.skipSuccessfulRequests) {
        let decremented = false;
        const decrementKey = () => {
          if (!decremented) {
            options.store.decrement(key);
            decremented = true;
          }
        };

        if (options.skipFailedRequests) {
          res.on("finish", function () {
            if (res.statusCode >= 400) {
              decrementKey();
            }
          });

          res.on("close", () => {
            if (!res.finished) {
              decrementKey();
            }
          });

          res.on("error", decrementKey);
        }

        if (options.skipSuccessfulRequests) {
          res.on("finish", function () {
            if (res.statusCode < 400) {
              options.store.decrement(key);
            }
          });
        }
      }

      if (delay !== 0) {
        const timerId = setTimeout(next, delay);
        res.on("close", () => {
          clearTimeout(timerId);
        });
        return timerId;
      }

      next();
    });
  }

  slowDown.resetKey = options.store.resetKey.bind(options.store);

  return slowDown;
}

module.exports = SlowDown;
