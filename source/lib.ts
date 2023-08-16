// /source/lib.ts
// The option parser and rate limiting middleware

import {
	rateLimit,
	type RateLimitExceededEventHandler,
	type Options as RateLimitOptions,
	type AugmentedRequest as RateLimitedRequest,
} from 'express-rate-limit'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type {
	Options,
	AugmentedRequest,
	SlowDownRequestHandler,
	ValueDeterminingMiddleware,
	DelayDeterminingMiddleware,
} from './types.js'

/**
 * The internal configuration interface.
 *
 * This is copied from Options, with fields made non-readonly and deprecated
 * fields removed.
 *
 * For documentation on what each field does, {@see Options}.
 *
 * This is not stored in types because it's internal to the API, and should not
 * be interacted with by the user.
 */
type Configuration = {
	// The options that we override and pass to express-rate-limit.
	// TODO: Update this whenever express-rate-limit's configuration is updated.
	max: number | ValueDeterminingMiddleware<number>
	legacyHeaders: boolean
	standardHeaders: boolean
	requestPropertyName: string
	handler: RateLimitExceededEventHandler
	// Note: It's not a class here.
	validate: boolean

	// The express-slow-down options.
	delayAfter: number | ValueDeterminingMiddleware<number>
	delayMs: number | ValueDeterminingMiddleware<number>
	maxDelayMs: number | ValueDeterminingMiddleware<number>
	delayFn: DelayDeterminingMiddleware
}

/**
 *
 * Remove any options where their value is set to undefined. This avoids overwriting defaults
 * in the case a user passes undefined instead of simply omitting the key.
 *
 * @param passedOptions {Options} - The options to omit.
 *
 * @returns {Options} - The same options, but with all undefined fields omitted.
 *
 * @private
 * @async
 */
const omitUndefinedOptions = (
	passedOptions: Partial<Options>,
): Partial<Options> => {
	const omittedOptions: Partial<Options> = {}

	for (const k of Object.keys(passedOptions)) {
		const key = k as keyof Options

		if (passedOptions[key] !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			omittedOptions[key] = passedOptions[key]
		}
	}

	return omittedOptions
}

/**
 * Type-checks and adds the defaults for options the user has not specified.
 *
 * @param options {Options} - The options the user specifies.
 *
 * @returns {Configuration} - A complete configuration object.
 *
 * @private
 */
const parseOptions = (passedOptions: Partial<Options>): Configuration => {
	// Passing undefined should be equivalent to not passing an option at all, so we'll
	// omit all fields where their value is undefined.
	const notUndefinedOptions: Partial<Options> =
		omitUndefinedOptions(passedOptions)

	// See ./types.ts#Options for a detailed description of the options and their
	// defaults.
	const config: Configuration = {
		delayAfter: 1,
		delayMs: 1000,
		maxDelayMs: Number.POSITIVE_INFINITY,
		async delayFn(hits, request, response) {
			const retrieve = async <T>(property: keyof Configuration): Promise<T> =>
				Promise.resolve(
					typeof config[property] === 'function'
						? // @ts-expect-error Why doesn't typescript understand I checked if it's a function?
						  config[property](request, response)
						: config[property],
				) as Promise<T>
			const delayAfter = await retrieve<number>('delayAfter')
			const delayMs = await retrieve<number>('delayMs')
			const maxDelayMs = await retrieve<number>('maxDelayMs')

			// The actual delay applied to the response is equal to the base delay
			// multiplied by the number of requests over the limit.
			const unboundedDelay = (hits - delayAfter) * delayMs
			return Math.min(unboundedDelay, maxDelayMs)
		},
		requestPropertyName: 'slowDown',
		validate: false,
		// Allow the options object to be overriden by the options passed to the middleware.
		...notUndefinedOptions,
		// The following options are passed in after the spread, so that they do not
		// get overriden.
		// TODO: Make this `?? 0` once the express-rate-limit v7 is released.
		max: notUndefinedOptions.delayAfter ?? 1, // `delayAfter` for slow down = `max` for rate limit.
		legacyHeaders: false,
		standardHeaders: false,
		async handler(request, response, next, options) {
			// Get the number of hits, and the total delay to apply.
			const hits = (request as RateLimitedRequest)[options.requestPropertyName]
				.current
			const delay = Math.max(0, await config.delayFn(hits, request, response))

			// If the delay is <= 0, don't delay the request. The delay will only be
			// negative if the hit count is less than the limit.
			if (delay <= 0) return next()
			;(request as AugmentedRequest)[options.requestPropertyName] = { delay }

			// If it is > 0, set a timer to delay the response, and clean up.
			const timerId = setTimeout(() => next(), delay)
			response.on('close', () => clearTimeout(timerId))
		},
	}

	return config
}

/**
 * Just pass on any errors for the developer to handle, usually as a HTTP 500
 * Internal Server Error.
 *
 * @param fn {RequestHandler} - The request handler for which to handle errors.
 *
 * @returns {RequestHandler} - The request handler wrapped with a `.catch` clause.
 *
 * @private
 */
const handleAsyncErrors =
	(fn: RequestHandler): RequestHandler =>
	async (request: Request, response: Response, next: NextFunction) => {
		try {
			await Promise.resolve(fn(request, response, next)).catch(next)
		} catch (error: unknown) {
			return next(error)
		}
	}

/**
 * Create an instance of IP throttling middleware for Express.
 *
 * @param passedOptions {Options} - Options to configure the middleware.
 *
 * @returns {SlowDownRequestHandler} - The middleware itself.
 *
 * @public
 */
const slowDown = (passedOptions?: Partial<Options>): SlowDownRequestHandler => {
	// Parse the options and add the default values for unspecified options.
	const options = passedOptions ?? {}
	const config = parseOptions(options)

	// Create an instance of express-rate-limit that does the actual work of
	// incrementing hits, and then wrap it in an instance of express-slow-down.
	const rateLimiter = rateLimit(config)
	const middleware = handleAsyncErrors(
		async (request: Request, response: Response, next: NextFunction) => {
			await Promise.resolve(rateLimiter(request, response, () => {}))
			const delayInfo = (request as AugmentedRequest)[
				config.requestPropertyName
			]

			// Ensure the delay code runs only once.
			if (!delayInfo || delayInfo.delay !== undefined) return next()
			config.handler(
				request,
				response,
				next,
				config as unknown as RateLimitOptions,
			) // TODO: This cast isn't a good thing, find a way to remove it.
		},
	)

	// Export the store's function to reset the hit counter for a particular
	// client based on their identifier.
	;(middleware as SlowDownRequestHandler).resetKey = rateLimiter.resetKey

	return middleware as SlowDownRequestHandler
}

// Export the function to the world!
export default slowDown
