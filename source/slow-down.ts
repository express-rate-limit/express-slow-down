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
		omitUndefinedOptions(passedOptions)

	if (
		notUndefinedOptions.headers ||
		notUndefinedOptions.legacyHeaders ||
		notUndefinedOptions.standardHeaders
	)
		throw new Error(
			'The headers options were removed in express-slow-down v2.0.0.',
		)

	if (
		notUndefinedOptions.max !== undefined ||
		notUndefinedOptions.limit !== undefined
	)
		throw new Error(
			'The limit/max option is not supported by express-slow-down, please use delayAfter instead.',
		)

	// TODO: Remove in v3.
	if (typeof notUndefinedOptions.delayMs === 'number') {
		const url = `https://express-rate-limit.github.io/WRN_ESD_DELAYMS/`
		const message = `
			The behaviour of the 'delayMs' option was changed in express-slow-down v2:
			- For the old behavior, change the delayMs option to:

			  delayMs: (used, req) => {
				  const delayAfter = req.${
						notUndefinedOptions.requestPropertyName ?? 'slowDown'
					}.limit;
				  return (used - delayAfter) * ${notUndefinedOptions.delayMs};
			  },

			- For the new behavior, change the delayMs option to:

				delayMs: () => ${notUndefinedOptions.delayMs},

			See ${url} for more information. Set 'options.validate.delayMs: false' to disable this error message.
		`.replace(/^(\t){3}/gm, '') // eslint-disable-line unicorn/prefer-string-replace-all
		const error = new Error(message)

		// Make sure the validation check is not disabled.
		if (
			notUndefinedOptions.validate === undefined ||
			notUndefinedOptions.validate === true ||
			(typeof notUndefinedOptions.validate === 'object' &&
				!notUndefinedOptions.validate.delayMs)
		) {
			console.warn(error)
		}
	}

	// Consolidate the validation options that have been passed by the user, and
	// apply them later, along with `limit: false`.
	const validate =
		typeof notUndefinedOptions.validate === 'boolean'
			? { default: notUndefinedOptions.validate }
			: notUndefinedOptions.validate

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
		validate: {
			...validate,
			limit: false, // We know the behavor of limit=0 changed - we depend on the new behavior!
		},

		// The following options are passed directly to `express-rate-limit`.
		...notUndefinedOptions,

		// These settings cannot be overriden.
		limit: 0, // We want the handler to run on every request.
		// Disable the headers, we don't want to send them.
		legacyHeaders: false,
		standardHeaders: false,
		// The handler contains the slow-down logic, so don't allow it to be overriden.
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

	// Create and return the special rate limiter.
	return rateLimit(options)
}

// Export it to the world!
export default slowDown
