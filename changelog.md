# express-slow-down changelog

## v3.0.0

### Added

- Added support for grouping IPv6 addresses by subnet (defaults to /56) via
  upgrading express-rate-limit dependency to 8.x

## v2.1.0

### Fixed

- Changed distributed JS to no longer bundle in `express-rate-limit`, instead
  using the version installed via npm. This enables several new
  express-rate-limit features that have been released since v7.0.1.

## v2.0.3

### Fixed

- Fixed `peerDependencies` compatibility with express 5 beta.

## v2.0.2

### Fixed

- Allowed `express-slow-down` to be used with `express` v5.

## v2.0.1

### Fixed

- Fixed an incorrect `WRN_ERL_MAX_ZERO` warning when supplying a custom
  validation object in the config.

## v2.0.0

express-slow-down v2 is built on top of express-rate-limit v7.

### Breaking

- Changed behavior of `delayMs` when set to a number
  - Previous behavior multiplied `delayMs` value by the number of slowed
    requests to determine the delay amount
  - New behavior treats a numeric value as a fixed delay that is applied to each
    slowed request without multiplication
  - Set to `function(used) { return (used - this.delayAfter) * 1000; }` to
    restore old behavior. (Change `1000` to match old value if necessary.)
- Changed arguments passed to `delayMs` when set to a function
  - Previous signature was `function(req, res): number`
  - New signature is `function(used, req, res): number | Promise<number>` where
    `used` is the number of hits from this user during the current window
- Dropped support for `onLimitReached` method
- Dropped support for `headers` option
- Renamed `req.slowDown.current` to `req.slowDown.used`
  - `current` is now a hidden getter that will return the `used` value, but will
    not be included when iteration over keys or running through
    `JSON.stringify()`

### Added

- `delayAfter`, `delayMs`, and `maxDelayMs` may now be async functions that
  return a number or a promise that resolves to a number
- The MemoryStore now uses precise, per-user reset times rather than a global
  window that resets all users at once.
- Now using express-rate-limit's validator to detect and warn about common
  misconfigurations. See
  https://github.com/express-rate-limit/express-rate-limit/wiki/Error-Codes for
  more info.
