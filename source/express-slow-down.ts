"use strict";
import type { Response, NextFunction } from 'express';
import { AugmentedRequest, Options } from "./types";

const { rateLimit } = require("express-rate-limit");

function slowDown(opts: Partial<Options> = {}) {
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
    delayMs: async function (used: number, req: AugmentedRequest, res: Response) {
      const delayAfter = typeof this.delayAfter === 'function' ? await this.delayAfter(req, res) : this.delayAfter
      return (used - delayAfter) * 1000;
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
    handler: async (req: AugmentedRequest, res: Response, next: NextFunction) => {
      const used = req[options.requestPropertyName].used;
      const unboundedDelay = typeof options.delayMs === 'function' ? await options.delayMs(used, req, res) : options.delayMs
      const maxDelayMs = typeof options.maxDelayMs === 'function' ? await options.maxDelayMs(req, res) : options.maxDelayMs
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

  // ensure delay is set on the SlowDownInfo for requests before delayAfter
  const wrappedSlowDown = async (req: AugmentedRequest, res: Response, next: NextFunction) => {
    await slowDown(req, res, () => {
      const info = req[options.requestPropertyName];
      if (info && !info.delay) {
        info.delay = 0;
      }
      next();
    });
  };

  wrappedSlowDown.resetKey = slowDown.resetKey;

  return wrappedSlowDown;
}

module.exports = slowDown;
module.exports.slowDown = slowDown;
