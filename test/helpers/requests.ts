import EventEmitter from 'node:events'
import { type Request, type Response, type NextFunction } from 'express'
import { expect, jest } from '@jest/globals'

function makeRequestPassValidation(request: any) {
	request.ip = '1.2.3.4'
	request.app = {
		get: () => false,
	}
	request.headers = []
}

// These helpers expect timers to be mocked and setTimeout to be spied on

export async function expectNoDelay(
	instance: any,
	request: any = new EventEmitter(),
	response: any = new EventEmitter(),
) {
	const next = jest.fn()
	makeRequestPassValidation(request)
	await instance(request as Request, response as Response, next as NextFunction)
	expect(setTimeout).not.toHaveBeenCalled()
	expect(next).toHaveBeenCalled()
}

export async function expectDelay(
	instance: any,
	expectedDelay: number,
	request: any = new EventEmitter(),
	response: any = new EventEmitter(),
) {
	const next = jest.fn()
	makeRequestPassValidation(request)

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
