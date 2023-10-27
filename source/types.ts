// /source/types.ts
// All the types used by this package

import type { Response } from 'express'
import type {
	AugmentedRequest as RateLimitedRequest,
	RateLimitInfo,
	Options as RateLimitOptions,
	ValueDeterminingMiddleware,
	EnabledValidations,
	RateLimitRequestHandler,
} from 'express-rate-limit'

/**
 * A modified Express request handler with the rate limit and slow down methods.
 */
export type SlowDownRequestHandler = RateLimitRequestHandler

/**
 * Method to generate the delay to apply to the incoming request.
 *
 * @param used {number} - The number of requests made by the client so far.
 * @param request {Request} - The Express request object.
 * @param response {Response} - The Express response object.
 *
 * @returns {number} - The delay to apply.
 */
export type DelayFn = (
	used: number,
	request: AugmentedRequest,
	response: Response,
) => number | Promise<number>

/**
 * Extra validation checks provided by `express-slow-down`.
 */
export type ExtendedValidations = EnabledValidations & { delayMs?: boolean }

/**
 * Options present in `express-rate-limit` that this package overrides.
 */
export type OverridenOptions = {
	/**
	 * The header options are not supported, and using them will throw an error.
	 */
	headers?: false
	legacyHeaders?: false
	standardHeaders?: false

	/**
	 * The `limit` option is set from the handler using `delayAfter`.
	 */
	limit: never
	max: never

	/**
	 * The `handler` option is overriden by the library.
	 */
	handler: never
}

/**
 * All the `express-slow-down` specific options.
 */
export type SlowDownOptions = {
	/**
	 * The max number of requests allowed during windowMs before the middleware
	 * starts delaying responses.
	 *
	 * Can be the limit itself as a number or a (sync/async) function that accepts
	 * the Express req and res objects and then returns a number.
	 *
	 * Defaults to 1.
	 */
	delayAfter: number | ValueDeterminingMiddleware<number>

	/**
	 * The delay to apply to each request once the limit is reached.
	 *
	 * Can be the limit itself as a number or a (sync/async) function that accepts
	 * the Express req and res objects and then returns a number.
	 *
	 * By default, it increases the delay by 1 second for every request over the limit.
	 */
	delayMs: number | DelayFn

	/**
	 * The absolute maximum value for delayMs. After many consecutive attempts,
	 * the delay will always be this value. This option should be used especially
	 * when your application is running behind a load balancer or reverse proxy
	 * that has a request timeout.
	 *
	 * Defaults to infinity.
	 */
	maxDelayMs: number | ValueDeterminingMiddleware<number>

	/**
	 * Allows the developer to turn off the validation check for `delayMs` being a
	 * function.
	 */
	validate: boolean | ExtendedValidations
}

/**
 * The configuration options for the middleware.
 */
export type Options = RateLimitOptions & OverridenOptions & SlowDownOptions

/**
 * The extended request object that includes information about the client's
 * rate limit and delay.
 */
export type AugmentedRequest = RateLimitedRequest & {
	[key: string]: SlowDownInfo
}

/**
 * The rate limit and delay related information for each client included in the
 * Express request object.
 */
export type SlowDownInfo = RateLimitInfo & {
	delay: number
}
