# Express Slow Down

[![CI](https://github.com/nfriedly/express-slow-down/actions/workflows/main.yml/badge.svg)](https://github.com/nfriedly/express-slow-down/actions/workflows/main.yml)[![NPM version](http://badge.fury.io/js/express-slow-down.png)](https://npmjs.org/package/express-slow-down "View this project on NPM")

Basic rate-limiting middleware for Express that slows down responses rather than blocking them outright. Use to limit repeated requests to public APIs and/or endpoints such as password reset.

Plays nice with [Express Rate Limit](https://npmjs.org/package/express-rate-limit)

Note: this module does not share state with other processes/servers by default. This module was extracted from Express Rate Limit 2.x and can work with it's stores:

### Stores

- Memory Store _(default, built-in)_ - stores hits in-memory in the Node.js process. Does not share state with other servers or processes.
- [Redis Store](https://npmjs.com/package/rate-limit-redis)
- [Memcached Store](https://npmjs.org/package/rate-limit-memcached)

Note: when using express-slow-down and express-rate-limit with an external store, you'll need to create two instances of the store and provide different prefixes so that they don't double-count requests.

## Install

```sh
$ npm install --save express-slow-down
```

## Usage

For an API-only server where the rules should be applied to all requests:

```js
const slowDown = require("express-slow-down");

app.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // allow 100 requests per 15 minutes, then...
  delayMs: 500 // begin adding 500ms of delay per request above 100:
  // request # 101 is delayed by  500ms
  // request # 102 is delayed by 1000ms
  // request # 103 is delayed by 1500ms
  // etc.
});

//  apply to all requests
app.use(speedLimiter);
```

For a "regular" web server (e.g. anything that uses `express.static()`), where the rate-limiter should only apply to certain requests:

```js
const slowDown = require("express-slow-down");

app.enable("trust proxy"); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc)

const resetPasswordSpeedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // allow 5 requests to go at full-speed, then...
  delayMs: 100 // 6th request has a 100ms delay, 7th has a 200ms delay, 8th gets 300ms, etc.
});

// only apply to POST requests to /reset-password/
app.post("/reset-password/", resetPasswordSpeedLimiter, function(req, res) {
  // handle /reset-password/ request here...
});
```

## `req.slowDown`

A `req.slowDown` property is added to all requests with the following fields:

- `limit`: The options.delayAfter value (defaults to 1)
- `current`: The number of requests in the current window
- `remaining`: The number of requests remaining before rate-limiting begins
- `resetTime`: When the window will reset and current will return to 0, and remaining will return to limit (in milliseconds since epoch - compare to Date.now()). Note: this field depends on store support. It will be undefined if the store does not provide the value.
- `delay`: Amount of delay imposed on current request (milliseconds)

## Configuration

- **windowMs**: milliseconds - how long to keep records of requests in memory. Defaults to `60000` (1 minute).
- **delayAfter**: max number of connections during `windowMs` before starting to delay responses. Number or function that returns a number. Defaults to `1`.
- **delayMs**: milliseconds - how long to delay the response, multiplied by (number of recent hits - `delayAfter`). Defaults to `1000` (1 second). Set to `0` to disable delaying.
- **maxDelayMs**: milliseconds - maximum value for `delayMs` after many consecutive attempts, that is, after the n-th request, the delay will be always `maxDelayMs`. Important when your application is running behind a load balancer or reverse proxy that has a request timeout. Defaults to `Infinity`.

  ```javascript
  // Example

  // Given:
  {
      delayAfter: 1,
      delayMs: 1000,
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
- **keyGenerator**: Function used to generate keys. By default user IP address (req.ip) is used. Defaults:

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

- **onLimitReached**: Function to listen the first time the limit is reached within windowMs. Defaults:

  ```js
  function (req, res, options) {
  /* empty */
  }
  ```

- **store**: The storage to use when persisting rate limit attempts. By default, the [MemoryStore](lib/memory-store.js) is used.
  - Note: when using express-slow-down and express-rate-limit with an external store, you'll need to create two instances of the store and provide different prefixes so that they don't double-count requests.
- **headers**: Add `X-SlowDown-Limit`, `X-SlowDown-Remaining`, and if the store supports it, `X-SlowDown-Reset` headers to all responses. Modeled after the equivalent headers in express-rate-limit. Default: `false`

## License

MIT © [Nathan Friedly](http://nfriedly.com/)
