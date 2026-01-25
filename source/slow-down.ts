// /source/express-slow-down.ts
// The speed limiting middleware.

import type { Request, Response, NextFunction } from 'express'
import { rateLimit, type Options as RateLimitOptions } from 'express-rate-limit'
import type {
	SlowDownRequestHandler,
	AugmentedRequest,
	SlowDownOptions,
	Options,
} from './types'

/**
 * Remove any options where their value is set to undefined. This avoids overwriting defaults
 * in the case a user passes undefined instead of simply omitting the key.
 *
 * @param passedOptions {Options} - The options to omit.
 *
 * @returns {Options} - The same options, but with all undefined fields omitted.
 *
 * @private
 */
const filterUndefinedOptions = (
	passedOptions: Partial<Options>,
): Partial<Options> => {
	const filteredOptions: Partial<Options> = {}

	for (const k of Object.keys(passedOptions)) {
		const key = k as keyof Options

		if (passedOptions[key] !== undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			filteredOptions[key] = passedOptions[key]
		}
	}

	return filteredOptions
}

// Consider exporting then extending express-rate-limit's ValidationError
class ExpressSlowDownWarning extends Error {
	name: string
	code: string
	help: string
	constructor(code: string, message: string) {
		const url = `https://express-rate-limit.github.io/${code}/`

		super(`${message} See ${url} for more information.`)

		this.name = this.constructor.name
		this.code = code
		this.help = url
	}
}

/**
 * Create an instance of middleware that slows down responses to Express requests.
 *
 * @param passedOptions {Options} - Options to configure the speed limiter.
 *
 * @returns {SlowDownRequestHandle} - The middleware that speed-limits clients based on your configuration.
 *
 * @public
 */
export const slowDown = (
	passedOptions: Partial<Options> = {},
): SlowDownRequestHandler => {
	// Passing undefined should be equivalent to not passing an option at all, so we'll
	// omit all fields where their value is undefined.
	const notUndefinedOptions: Partial<Options> =
		filterUndefinedOptions(passedOptions)

	if (
		notUndefinedOptions.max !== undefined ||
		notUndefinedOptions.limit !== undefined
	)
		throw new Error(
			'The limit/max option is not supported by express-slow-down, please use delayAfter instead.',
		)

	// Consolidate the validation options that have been passed by the user, and
	// apply them later, along with `limit: false`.
	const validate =
		typeof notUndefinedOptions.validate === 'boolean'
			? { default: notUndefinedOptions.validate }
			: notUndefinedOptions.validate ?? { default: true }

	// Deprecation warning for delayMs behavior change from v2
	if (
		typeof notUndefinedOptions.delayMs === 'number' &&
		// Make sure the validation check is not disabled.
		(validate.delayMs === true ||
			(validate.delayMs === undefined && validate.default))
	) {
		const message =
			`The behaviour of the 'delayMs' option was changed in express-slow-down v2:
			- For the old behavior, change the delayMs option to:

			  delayMs: (used, req) => {
				  const delayAfter = req.${
						notUndefinedOptions.requestPropertyName ?? 'slowDown'
					}.limit;
				  return (used - delayAfter) * ${notUndefinedOptions.delayMs};
			  },

			- For the new behavior, change the delayMs option to:

				delayMs: () => ${notUndefinedOptions.delayMs},

			Or set 'options.validate: {delayMs: false}' to disable this message.`.replace(
				/^(\t){3}/gm,
				'',
			)

		console.warn(new ExpressSlowDownWarning('WRN_ESD_DELAYMS', message))
	}

	// Express-rate-limit will warn about enabling or disabling unknown validations,
	// so delete the delayMs flag (if set)
	delete validate?.delayMs

	// See ./types.ts#Options for a detailed description of the options and their
	// defaults.
	const options: Partial<RateLimitOptions> & SlowDownOptions = {
		// The following settings are defaults that may be overridden by the user's options.
		delayAfter: 1,
		delayMs(used: number, request: AugmentedRequest, response: Response) {
			const delayAfter = request[options.requestPropertyName!].limit
			return (used - delayAfter) * 1000
		},
		maxDelayMs: Number.POSITIVE_INFINITY,
		requestPropertyName: 'slowDown',

		legacyHeaders: false,
		standardHeaders: false,

		// Next the user's options are pulled in, overriding defaults from above
		...notUndefinedOptions,

		// This is a combination of the user's validate settings and our own overrides
		validate: {
			...validate,
			limit: false, // We know the behavior of limit=0 changed - we depend on the new behavior!
		},

		// These settings cannot be overridden.
		limit: 0, // We want the handler to run on every request.
		// Disable the headers, we don't want to send them.
		// The handler contains the slow-down logic, so don't allow it to be overridden.
		async handler(_request: Request, response: Response, next: NextFunction) {
			// Get the number of requests after which we should speed-limit the client.
			const delayAfter =
				typeof options.delayAfter === 'function'
					? await options.delayAfter(_request, response)
					: options.delayAfter

			// Set the limit to that value, and compute the remaining requests as well.
			const request = _request as AugmentedRequest
			const info = request[options.requestPropertyName!]
			info.limit = delayAfter
			info.remaining = Math.max(0, delayAfter - info.used)

			// Compute the delay, if required.
			let delay = 0
			if (info.used > delayAfter) {
				const unboundedDelay =
					typeof options.delayMs === 'function'
						? await options.delayMs(info.used, request, response)
						: options.delayMs
				const maxDelayMs =
					typeof options.maxDelayMs === 'function'
						? await options.maxDelayMs(request, response)
						: options.maxDelayMs

				// Make sure the computed delay does not exceed the max delay.
				delay = Math.max(0, Math.min(unboundedDelay, maxDelayMs))
			}

			// Make sure the delay is also passed on with the request.
			request[options.requestPropertyName!].delay = delay

			// If we don't need to delay the request, send it on its way.
			if (delay <= 0) return next()

			// Otherwise, set a timer and call `next` when the timer runs out.
			const timerId = setTimeout(() => next(), delay)
			response.on('close', () => clearTimeout(timerId))
		},
	}

	// Express-rate-limit will also warn about unexpected options, so use destructuring to create an object without the ESD options
	const { delayAfter, delayMs, maxDelayMs, ...erlOptions } = options

	// Create and return the special rate limiter.
	return rateLimit(erlOptions)
}

// Export it to the world!
export default slowDown
