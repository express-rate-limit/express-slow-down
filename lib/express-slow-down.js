"use strict";
const { rateLimit } = require("express-rate-limit");

function getValue(maybeFn, context, params) {
  return typeof maybeFn === "function"
    ? maybeFn.apply(context, params)
    : maybeFn;
}

function slowDown(opts = {}) {
  if (opts.headers || opts.legacyHeaders || opts.standardHeaders) {
    throw new Error("express-slow-down headers option was removed in v2.0.0");
  }
  if (opts.max) {
    throw new Error(
      "express-slow-down max option is not supported, use delayAfter instead"
    );
  }

  const options = {
    // default settings that may be overridden
    delayAfter: 1, // how many requests to allow through before starting to delay responses
    delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits for the same key.
    maxDelayMs: Infinity, // milliseconds - maximum delay to be applied to the response, regardless the request count. Infinity means that the delay will grow continuously and unboundedly
    requestPropertyName: "slowDown",
    delayFn: async (hits, req, res) => {
      const delayAfter = await getValue(options.delayAfter, options, [
        req,
        res,
      ]);
      const delayMs = await getValue(options.delayMs, options, [req, res]);
      const maxDelayMs = await getValue(options.maxDelayMs, options, [
        req,
        res,
      ]);
      const unboundedDelay = (hits - delayAfter) * delayMs;
      return Math.min(unboundedDelay, maxDelayMs);
    },
    validate: false,
    // additional options are passed directly to express-rate-limit
    ...opts,
    // these settings cannot be overriden
    max: opts.delayAfter ?? 1, // `delayAfter` for express-slow-down is `max` for express-rate-limit.
    legacyHeaders: false,
    standardHeaders: false,
    handler: async (req, res, next) => {
      const hits = req[options.requestPropertyName].current;
      const delay = Math.max(0, await options.delayFn(hits, req, res));

      // todo: consider a wrapper to set this to 0 for non-max requests
      req[options.requestPropertyName].delay = delay;

      if (delay <= 0) {
        return next();
      }

      const timerId = setTimeout(() => {
        next();
      }, delay);
      res.on("close", () => {
        clearTimeout(timerId);
      });
      return timerId; //todo: do i need this for tests?S
    },
  };

  // todo: enable this, update the tests, remove the wrapper
  // if (options.delayAfter < 1) {
  //   throw new Error("express-slow-down delayAfter option must be >= 1");
  // }

  // express-rate-limit treats max=0 as special, so we have to work around that here
  const wrapped = rateLimit({ ...options, max: options.max || 1 });

  const slowDown = async (req, res, next) => {
    await wrapped(req, res, async () => {
      // ensure handler is called exactly once (or skip returned true)
      const results = req[options.requestPropertyName];
      if (!results || "delay" in results) {
        next();
      } else {
        await options.handler(req, res, next);
      }
    });
  };

  slowDown.resetKey = wrapped.resetKey;

  return slowDown;
}

module.exports = slowDown;
module.exports.slowDown = slowDown;
