# Express Slow Down

[![CI](https://github.com/nfriedly/express-slow-down/actions/workflows/main.yml/badge.svg)](https://github.com/nfriedly/express-slow-down/actions/workflows/main.yml)
[![npm version](https://img.shields.io/npm/v/express-slow-down.svg)](https://npmjs.org/package/express-slow-down 'View this project on NPM')
[![npm downloads](https://img.shields.io/npm/dm/express-slow-down)](https://www.npmjs.com/package/express-slow-down)

Basic rate-limiting middleware for Express that slows down responses rather than blocking them outright. Use to slow repeated requests to public APIs and/or endpoints such as password reset.

Plays nice with (and built on top of) [Express Rate Limit](https://npmjs.org/package/express-rate-limit)

### Stores

The default memory store does not share state with any other processes or servers. It's sufficient for basic abuse prevention, but an external store will provide more consistency.

express-slow-down uses [express-rate-limit's stores](https://github.com/express-rate-limit/express-rate-limit#store)

Note: when using express-slow-down and express-rate-limit with an external store, you'll need to create two instances of the store and provide different prefixes so that they don't double-count requests.

## Install

```sh
$ npm install --save express-slow-down
```

## Usage

For an API-only server where the rules should be applied to all requests:

```js
const slowDown = require("express-slow-down");

// app.set("trust proxy", 1); // see https://github.com/express-rate-limit/express-rate-limit/wiki/Troubleshooting-Proxy-Issues

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // allow 5 requests per 15 minutes, then...
  delayMs: (hits) => hits * 100, // begin adding 100ms of delay per request:
  // requests 1-5 are not delayed
  // request # 6 is delayed by 600ms
  // request # 7 is delayed by 700ms
  // request # 8 is delayed by 800ms
  // etc.
  // after 15 minutes, the delay is reset to 0
});

//  apply to all requests
app.use(speedLimiter);
```

For a "regular" web server (e.g. anything that uses `express.static()`), where the rate-limiter should only apply to certain requests:

```js
const slowDown = require("express-slow-down");

// app.set("trust proxy", 1); // see https://github.com/express-rate-limit/express-rate-limit/wiki/Troubleshooting-Proxy-Issues

const resetPasswordSpeedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 1 // allow 1 request to go at full-speed, then...
  delayMs: (hits) => hits * hits * 1000, // 2nd request has a 4 second delay, 3rd is 9 seconds, 4th is 16, etc.
});

// only apply to POST requests to /reset-password/
app.post("/reset-password/", resetPasswordSpeedLimiter, function(req, res) {
  // handle /reset-password/ request here...
});
```

## `req.slowDown`

A `req.slowDown` property is added to all requests with the following fields:

- `limit`: The options.delayAfter value (defaults to 1)
- `used`: The number of requests made in the current window (including this request)
- `remaining`: The number of requests remaining before rate-limiting begins
- `resetTime`: When the window will reset and current will return to 0, and remaining will return to limit (in milliseconds since epoch - compare to Date.now()). Note: this field depends on store support. It will be undefined if the store does not provide the value.
- `delay`: Amount of delay imposed on current request (milliseconds)

## Configuration

- **windowMs**: `number` - milliseconds - how long to keep records of requests. (Note that some stores use their own setting to control this.) Defaults to `60000` (1 minute).
- **delayAfter**: `number` | `(req, res) =>  number| Promise<number>` - max number of connections during `windowMs` before starting to delay responses. Number or function that returns a number. Defaults to `1`.
- **delayMs**: `number` | `(used, req, res) =>  number| Promise<number>` - milliseconds - how long to delay the response. Defaults to `(used) => (used - delayAfter) * 1000`.

  Function example:
  ```js
  app.use(slowDown({
    delayAfter:  3,
    delayMs: (used, req, res) => used * 100; // 100ms delay per hit.
  }))
  // Results will be:
  // 1st request - no delay
  // 2nd request - no delay
  // 3rd request - no delay
  // 4th request - 400ms delay
  // 5th request - 500ms delay
  ```

  Fixed number example:

  Example:
  ```js
  app.use(slowDown({
    delayAfter:  3,
    delayMs: 1000,
  }))
  // Results will be:
  // 1st request - no delay
  // 2nd request - no delay
  // 3rd request - no delay
  // 4th request - 1000ms delay
  // 5th request - 1000ms delay
  ```

- **maxDelayMs**: `number` | `(req, res) =>  number| Promise<number>` - milliseconds - maximum value for `delayMs` after many consecutive attempts, that is, after the n-th request, the delay will always be `maxDelayMs`. Important when your application is running behind a load balancer or reverse proxy that has a request timeout. Defaults to `Infinity`.

  ```javascript
  // Example

  // Given:
  {
      delayAfter: 1,
      delayMs: hits => hits * 1000,
      maxDelayMs: 20000,
  }

  // Results will be:
  // 1st request - no delay
  // 2nd request - 1000ms delay
  // 3rd request - 2000ms delay
  // 4th request - 3000ms delay
  // ...
  // 20th request - 19000ms delay
  // 21st request - 20000ms delay
  // 22nd request - 20000ms delay
  // 23rd request - 20000ms delay
  // 24th request - 20000ms delay <-- will not increase past 20000ms
  // ...
  ```
- **skipFailedRequests**: when `true` failed requests (response status >= 400) won't be counted. Defaults to `false`.
- **skipSuccessfulRequests**: when `true` successful requests (response status < 400) won't be counted. Defaults to `false`.
- **keyGenerator**: Function used to generate keys. By default user IP address (req.ip) is used, similar to:

  ```js
  function (req /*, res*/) {
      return req.ip;
  }
  ```

- **skip**: Function used to skip requests. Returning true from the function will skip limiting for that request. Defaults:

  ```js
  function (/*req, res*/) {
      return false;
  }
  ```

- **store**: The storage to use when persisting rate limit attempts. See https://github.com/express-rate-limit/express-rate-limit#store
  - Note: when using express-slow-down and express-rate-limit with an external store, you'll need to create two instances of the store and provide different prefixes so that they don't double-count requests.

### Additonal options from express-rate-Limit

Because express-rate-limit is used internally, additional options that it supports may be passed in. See https://github.com/express-rate-limit/express-rate-limit#configuration for the complete list. Note that the `limit` (`max`) option is not supported (use `delayAfter` instead), nor is the `handler` or various headers options.

## License

MIT © [Nathan Friedly](http://nfriedly.com/)
