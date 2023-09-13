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
  if (opts.max !== undefined || opts.limit !== undefined) {
    throw new Error(
      "express-slow-down limit / max option is not supported, use delayAfter instead"
    );
  }

  const validate =
    typeof opts.validate == "boolean"
      ? { default: opts.validate }
      : opts.validate;

  const options = {
    // default settings that may be overridden
    delayAfter: 1, // how many requests to allow through before starting to delay responses
    delayMs: function (used /*,req, res*/) {
      return (used - this.delayAfter) * 1000;
    }, // number or function (may be async)
    maxDelayMs: Infinity, // milliseconds - maximum delay to be applied to the response, regardless the request count. Infinity means that the delay will grow continuously and unboundedly
    requestPropertyName: "slowDown",
    validate: {
      ...validate,
      limit: false, // we know the behavor of limit=0 changed - we depend on the new behavior!
    },
    // additional options are passed directly to express-rate-limit
    ...opts,
    // these settings cannot be overriden
    limit: opts.delayAfter ?? 1, // `delayAfter` for express-slow-down is `limit` for express-rate-limit.
    legacyHeaders: false,
    standardHeaders: false,
    handler: async (req, res, next) => {
      const used = req[options.requestPropertyName].used;
      const unboundedDelay = await getValue(options.delayMs, options, [
        used,
        req,
        res,
      ]);
      const maxDelayMs = await getValue(options.maxDelayMs, options, [
        req,
        res,
      ]);
      const delay = Math.max(0, Math.min(unboundedDelay, maxDelayMs));

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

  const slowDown = rateLimit(options);

  // ensure delay is set on the object
  const wrapped = async (req, res, next) => {
    await slowDown(req, res, () => {
      const info = req[options.requestPropertyName];
      if (info && !info.delay) {
        info.delay = 0;
      }
      next();
    });
  };

  wrapped.resetKey = slowDown.resetKey;

  return wrapped;
}

module.exports = slowDown;
module.exports.slowDown = slowDown;
