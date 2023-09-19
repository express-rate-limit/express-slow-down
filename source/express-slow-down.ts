'use strict'
import type { Request, Response, NextFunction } from 'express'
import { rateLimit } from 'express-rate-limit'
import { type AugmentedRequest, type Options } from './types'

export function slowDown(options_: Partial<Options> = {}) {
	if (options_.headers || options_.legacyHeaders || options_.standardHeaders) {
		throw new Error('express-slow-down headers option was removed in v2.0.0')
	}

	if (options_.max !== undefined || options_.limit !== undefined) {
		throw new Error(
			'express-slow-down limit / max option is not supported, use delayAfter instead',
		)
	}

	const validate =
		typeof options_.validate === 'boolean'
			? { default: options_.validate }
			: options_.validate

	const options = {
		// Default settings that may be overridden
		delayAfter: 1, // How many requests to allow through before starting to delay responses
		async delayMs(used: number, request: AugmentedRequest, res: Response) {
			const delayAfter =
				typeof this.delayAfter === 'function'
					? await this.delayAfter(request, res)
					: this.delayAfter
			return (used - delayAfter) * 1000
		}, // Number or function (may be async)
		maxDelayMs: Number.POSITIVE_INFINITY, // Milliseconds - maximum delay to be applied to the response, regardless the request count. Infinity means that the delay will grow continuously and unboundedly
		requestPropertyName: 'slowDown',
		validate: {
			...validate,
			limit: false, // We know the behavor of limit=0 changed - we depend on the new behavior!
		},
		// Additional options are passed directly to express-rate-limit
		...options_,
		// These settings cannot be overriden
		limit: options_.delayAfter ?? 1, // `delayAfter` for express-slow-down is `limit` for express-rate-limit.
		legacyHeaders: false,
		standardHeaders: false,
		async handler(
			_request: Request,
			res: Response,
			next: NextFunction,
		) {
      const request = _request as AugmentedRequest
			const { used } = request[options.requestPropertyName]
			const unboundedDelay =
				typeof options.delayMs === 'function'
					? await options.delayMs(used, request, res)
					: options.delayMs
			const maxDelayMs =
				typeof options.maxDelayMs === 'function'
					? await options.maxDelayMs(request, res)
					: options.maxDelayMs
			const delay = Math.max(0, Math.min(unboundedDelay, maxDelayMs))

			request[options.requestPropertyName].delay = delay

			if (delay <= 0) {
				return next()
			}

			const timerId = setTimeout(() => {
				next()
			}, delay)
			res.on('close', () => {
				clearTimeout(timerId)
			})
			return timerId // Todo: do i need this for tests?S
		},
	}

	const slowDown = rateLimit(options)

	// Ensure delay is set on the SlowDownInfo for requests before delayAfter
	const wrappedSlowDown = async (
		request: AugmentedRequest,
		res: Response,
		next: NextFunction,
	) => {
		await slowDown(request, res, () => {
			const info = request[options.requestPropertyName]
			if (info && !info.delay) {
				info.delay = 0
			}

			next()
		})
	}

	wrappedSlowDown.resetKey = slowDown.resetKey

	return wrappedSlowDown
}

export default slowDown