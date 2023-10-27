// /test/helpers/requests.ts
// Exports functions that check for delay

import EventEmitter from 'node:events'
import type { Request, Response, NextFunction } from 'express'
import { expect, jest } from '@jest/globals'

/**
 * Converts an `EventEmitter` into an Express `req` object, at least in the
 * eyes of the middleware.
 */
const impersonateRequest = (request: any) => {
	request.ip = '1.2.3.4'
	request.app = {
		get: () => false,
	}
	request.headers = []
}

/**
 * NOTE: these helpers expect timers to be mocked and setTimeout to be spied on.
 */

/**
 * Call the instance with a request and response, and make sure the request was
 * NOT delayed.
 */
export const expectNoDelay = async (
	instance: any,
	request: any = new EventEmitter(),
	response: any = new EventEmitter(),
) => {
	const next = jest.fn()
	impersonateRequest(request)

	await instance(request as Request, response as Response, next as NextFunction)

	expect(setTimeout).not.toHaveBeenCalled()
	expect(next).toHaveBeenCalled()
}

/**
 * Call the instance with a request and response, and make sure the request was
 * delayed by a certain amount of time.
 */
export async function expectDelay(
	instance: any,
	expectedDelay: number,
	request: any = new EventEmitter(),
	response: any = new EventEmitter(),
) {
	const next = jest.fn()
	impersonateRequest(request)

	// Set the timeout
	await instance(request as Request, response as Response, next as NextFunction)
	expect(setTimeout).toHaveBeenCalled()
	expect(next).not.toHaveBeenCalled()

	// Wait for it...
	jest.advanceTimersByTime(expectedDelay - 1)
	expect(next).not.toHaveBeenCalled()

	// Now!
	jest.advanceTimersByTime(1)
	expect(next).toHaveBeenCalled()
}

export const expectNoDelayPromise = expectNoDelay
