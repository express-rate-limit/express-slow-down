# express-slow-down changelog

## v2.0.0

express-slow-down v2 is built on top of express-rate-limit v7.

### Breaking

* Changed behavior of `delayMs`
  * Previous behavior multiplied `delayMs` value by the number of slowed requests to determine the delay amount
  * New behavior treats a numeric value as a fixed delay that is applied to each slowed request without multiplication
  * Set to `function(used) { return (used - this.delayAfter) * 1000; }` to restore old behavior. (Change `1000` to match old value if necessary.)
* Dropped support for `onLimitReached` method
* Dropped support for `headers` option
* Renamed `req.slowDown.current` to `req.slowDown.used`
    * `current` is now a hidden getter that will return the `used` value, but will not be included when iteration over keys or running through `JSON.stringify()`

### Added

* Added compatibility with modern express-rate-limit Stores
* `delayAfter`, `delayMs`, and `maxDelayMs` may each be functions that return a number or a promise that resolves to a number.