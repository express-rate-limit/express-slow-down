// /source/types.ts
// All the types used by this package

import type { Request, Response } from 'express'
import type {
	RateLimitRequestHandler,
	ValueDeterminingMiddleware,
	Options as RateLimitOptions,
} from 'express-rate-limit'

export { type ValueDeterminingMiddleware } from 'express-rate-limit'
export type SlowDownRequestHandler = RateLimitRequestHandler

/**
 * Function used to determine the actual delay applied to a response.
 *
 * @param hits {number} - The number of hits for that client so far.
 * @param request {Request} - The Express request object.
 * @param response {Response} - The Express response object.
 *
 * @returns {number} - The delay to apply.
 */
export type DelayDeterminingMiddleware = (
	hits: number,
	request: Request,
	response: Response,
) => number | Promise<number>

/**
 * A modified Express request handler with the delay functions.
 */

/**
 * The configuration options for the request delayer.
 */
export type Options = RateLimitOptions & {
	/**
	 * The number of requests to allow through before starting to delay responses.
	 *
	 * Defaults to 1.
	 */
	delayAfter: number | ValueDeterminingMiddleware<number>

	/**
	 * The base delay, to be multiplied by the number of hits before applying it
	 * to the response.
	 *
	 * Defaults to 1000 (= 1 second).
	 */
	delayMs: number | ValueDeterminingMiddleware<number>

	/**
	 * The maximum delay that can be applied to any response.
	 *
	 * Defaults to infinity.
	 */
	maxDelayMs: number | ValueDeterminingMiddleware<number>

	/**
	 * The function to determine the actual delay applied to the response.
	 *
	 * Defaults to a linear backoff function.
	 */
	delayFn: DelayDeterminingMiddleware
}

/**
 * The extended request object that includes information about the client's
 * rate limit.
 */
export type AugmentedRequest = Request & {
	[key: string]: DelayInfo
}

/**
 * The delay information for each client included in the Express request object.
 */
export type DelayInfo = {
	delay: number
}
