# <div align="center"> Express Slow Down </div>

<div align="center">

[![tests](https://github.com/express-rate-limit/express-slow-down/actions/workflows/ci.yaml/badge.svg)](https://github.com/express-rate-limit/express-slow-down/actions/workflows/ci.yaml)
[![npm version](https://img.shields.io/npm/v/express-slow-down.svg)](https://npmjs.org/package/express-slow-down 'View this project on NPM')
[![npm downloads](https://img.shields.io/npm/dm/express-slow-down)](https://www.npmjs.com/package/express-slow-down)

Basic rate-limiting middleware for Express that slows down responses rather than
blocking them outright. Use to slow repeated requests to public APIs and/or
endpoints such as password reset.

Plays nice with (and built on top of)
[Express Rate Limit](https://npmjs.org/package/express-rate-limit)

</div>

### Stores

The default memory store does not share state with any other processes or
servers. It's sufficient for basic abuse prevention, but an external store will
provide more consistency.

express-slow-down uses
[express-rate-limit's stores](https://express-rate-limit.mintlify.app/reference/stores)

> **Note**: when using express-slow-down and express-rate-limit with an external
> store, you'll need to create two instances of the store and provide different
> prefixes so that they don't double-count requests.

## Installation

From the npm registry:

```sh
# Using npm
> npm install express-slow-down
# Using yarn or pnpm
> yarn/pnpm add express-slow-down
```

From Github Releases:

```sh
# Using npm
> npm install https://github.com/express-rate-limit/express-slow-down/releases/download/v{version}/express-slow-down.tgz
# Using yarn or pnpm
> yarn/pnpm add https://github.com/express-rate-limit/express-slow-down/releases/download/v{version}/express-slow-down.tgz
```

Replace `{version}` with the version of the package that you want to your, e.g.:
`2.0.0`.

## Usage

### Importing

This library is provided in ESM as well as CJS forms, and works with both
Javascript and Typescript projects.

**This package requires you to use Node 16 or above.**

Import it in a CommonJS project (`type: commonjs` or no `type` field in
`package.json`) as follows:

```ts
const { slowDown } = require('express-slow-down')
```

Import it in a ESM project (`type: module` in `package.json`) as follows:

```ts
import { slowDown } from 'express-slow-down'
```

### Examples

To use it in an API-only server where the speed-limiter should be applied to all
requests:

```ts
import { slowDown } from 'express-slow-down'

const limiter = slowDown({
	windowMs: 15 * 60 * 1000, // 15 minutes
	delayAfter: 5, // Allow 5 requests per 15 minutes.
	delayMs: (hits) => hits * 100, // Add 100 ms of delay to every request after the 5th one.

	/**
	 * So:
	 *
	 * - requests 1-5 are not delayed.
	 * - request 6 is delayed by 600ms
	 * - request 7 is delayed by 700ms
	 * - request 8 is delayed by 800ms
	 *
	 * and so on. After 15 minutes, the delay is reset to 0.
	 */
})

// Apply the delay middleware to all requests.
app.use(limiter)
```

To use it in a 'regular' web server (e.g. anything that uses
`express.static()`), where the rate-limiter should only apply to certain
requests:

```ts
import { slowDown } from 'express-slow-down'

const apiLimiter = slowDown({
	windowMs: 15 * 60 * 1000, // 15 minutes
	delayAfter: 1, // Allow only one request to go at full-speed.
	delayMs: (hits) => hits * hits * 1000, // 2nd request has a 4 second delay, 3rd is 9 seconds, 4th is 16, etc.
})

// Apply the delay middleware to API calls only.
app.use('/api', apiLimiter)
```

To use a custom store:

```ts
import { slowDown } from 'express-slow-down'
import { MemcachedStore } from 'rate-limit-memcached'

const speedLimiter = slowDown({
	windowMs: 15 * 60 * 1000, // 15 minutes
	delayAfter: 1, // Allow only one request to go at full-speed.
	delayMs: (hits) => hits * hits * 1000, // Add exponential delay after 1 request.
	store: new MemcachedStore({
		/* ... */
	}), // Use the external store
})

// Apply the rate limiting middleware to all requests.
app.use(speedLimiter)
```

> **Note:** most stores will require additional configuration, such as custom
> prefixes, when using multiple instances. The default built-in memory store is
> an exception to this rule.

## Configuration

### [`windowMs`](https://express-rate-limit.mintlify.app/reference/configuration#windowms)

> `number`

Time frame for which requests are checked/remembered.

Note that some stores have to be passed the value manually, while others infer
it from the options passed to this middleware.

Defaults to `60000` ms (= 1 minute).

### `delayAfter`

> `number` | `function`

The max number of requests allowed during `windowMs` before the middleware
starts delaying responses. Can be the limit itself as a number or a (sync/async)
function that accepts the Express `req` and `res` objects and then returns a
number.

Defaults to `1`.

An example of using a function:

```ts
const isPremium = async (user) => {
	// ...
}

const limiter = slowDown({
	// ...
	delayAfter: async (req, res) => {
		if (await isPremium(req.user)) return 10
		else return 1
	},
})
```

### `delayMs`

> `number | function`

The delay to apply to each request once the limit is reached. Can be the delay
itself (in milliseconds) as a number or a (sync/async) function that accepts a
number (number of requests in the current window), the Express `req` and `res`
objects and then returns a number.

By default, it increases the delay by 1 second for every request over the limit:

```ts
const limiter = slowDown({
	// ...
	delayMs: (used) => (used - delayAfter) * 1000,
})
```

### `maxDelayMs`

> `number | function`

The absolute maximum value for `delayMs`. After many consecutive attempts, the
delay will always be this value. This option should be used especially when your
application is running behind a load balancer or reverse proxy that has a
request timeout. Can be the number itself (in milliseconds) or a (sync/async)
function that accepts the Express `req` and `res` objects and then returns a
number.

Defaults to `Infinity`.

For example, for the following configuration:

```ts
const limiter = slowDown({
	// ...
	delayAfter: 1,
	delayMs: (hits) => hits * 1000,
	maxDelayMs: 4000,
})
```

The first request will have no delay. The second will have a 2 second delay, the
3rd will have a 3 second delay, but the fourth, fifth, sixth, seventh and so on
requests will all have a 4 second delay.

### Options from [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit)

Because
[`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit)
is used internally, additional options that it supports may be passed in. Some
of them are listed below; see `express-rate-limit`'s
[documentation](https://express-rate-limit.mintlify.app/reference/configuration)
for the complete list.

> **Note**: The `limit` (`max`) option is not supported (use `delayAfter`
> instead), nor are `handler` or the various headers options.

- [`requestPropertyName`](https://express-rate-limit.mintlify.app/reference/configuration#requestpropertyname)
- [`skipFailedRequests`](https://express-rate-limit.mintlify.app/reference/configuration#skipfailedrequests)
- [`skipSuccessfulRequests`](https://express-rate-limit.mintlify.app/reference/configuration#skipsuccessfulrequests)
- [`keyGenerator`](https://express-rate-limit.mintlify.app/reference/configuration#keygenerator)
- [`skip`](https://express-rate-limit.mintlify.app/reference/configuration#skip)
- [`requestWasSuccessful`](https://express-rate-limit.mintlify.app/reference/configuration#requestwassuccessful)
- [`validate`](https://express-rate-limit.mintlify.app/reference/configuration#validate)
- [`store`](https://express-rate-limit.mintlify.app/reference/configuration#store)

## Request API

A `req.slowDown` property is added to all requests with the `limit`, `used`, and
`remaining` number of requests and, if the store provides it, a `resetTime` Date
object. It also has the `delay` property, which is the amount of delay imposed
on current request (milliseconds). These may be used in your application code to
take additional actions or inform the user of their status.

Note that `used` includes the current request, so it should always be > 0.

The property name can be configured with the configuration option
`requestPropertyName`.

## Issues and Contributing

If you encounter a bug or want to see something added/changed, please go ahead
and
[open an issue](https://github.com/express-rate-limit/express-slow-down/issues/new)!
If you need help with something, feel free to
[start a discussion](https://github.com/express-rate-limit/express-slow-down/discussions/new)!

If you wish to contribute to the library, thanks! First, please read
[the contributing guide](contributing.md). Then you can pick up any issue and
fix/implement it!

## License

MIT © [Nathan Friedly](http://nfriedly.com/),
[Vedant K](https://github.com/gamemaker1)
