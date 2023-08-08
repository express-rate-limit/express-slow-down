"use strict";
const { rateLimit } = require("express-rate-limit");

async function getValue(maybeFn, context, params) {
  return typeof maybeFn === "function"
    ? await maybeFn.apply(context, params)
    : maybeFn;
}

function slowDown(opts) {
  const options = {
    // default settings that may be overridden
    delayAfter: 1, // how many requests to allow through before starting to delay responses
    delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits for the same key.
    maxDelayMs: Infinity, // milliseconds - maximum delay to be applied to the response, regardless the request count. Infinity means that the delay will grow continuously and unboundedly
    requestPropertyName: "slowDown",
    delayFn: async (hits, options, req, res) => {
      const delayAfter = await getValue(options.delayAfter, options, [
        req,
        res,
      ]);
      const delayMs = await getValue(options.delayMs, options, [req, res]);
      const maxDelayMs = await getValue(options.delayAfter, options, [
        req,
        res,
      ]);
      const unboundedDelay = (hits - delayAfter) * delayMs;
      return Math.min(unboundedDelay, maxDelayMs);
    },
    // additional options are passed directly to express-rate-limit
    ...opts,
    // these settings cannot be overriden
    max: opts?.delayAfter ?? 1, // `delayAfter` for express-slow-down is `max` for express-rate-limit.
    handler: async (req, res, next, options) => {
      const delay = await options.delayFn(
        req[options.requestPropertyName].current,
        options,
        req,
        res
      );

      // todo: consider a wrapper to set this to 0 for non-max requests
      req[options.requestPropertyName].delay = delay;

      if (delay <= 0) {
        return next();
      }

      const timerId = setTimeout(next, delay);
      res.on("close", () => {
        clearTimeout(timerId);
      });
    },
  };

  const slowDown = rateLimit(options);

  return slowDown;
}

module.exports = slowDown;
module.exports.slowDown = slowDown;
