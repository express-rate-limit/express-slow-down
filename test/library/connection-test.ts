// /test/library/connection-test.ts
// Tests the behaviour upon abrupt connection closure

import EventEmitter from 'node:events'
import { jest } from '@jest/globals'
import slowDown from '../../source/index.js'

describe('connection', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(global, 'setTimeout')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	it('should not excute slow down timer in case of req closed', async () => {
		const request = new EventEmitter() as any
		const res = new EventEmitter() as any

		// Gotta do a bunch of sillyness to convince it the request isn't finished at the start.
		request.socket = new EventEmitter()
		request.socket.readable = true
		request.complete = false
		request.readable = true
		res.finished = false
		const instance = slowDown({
			skipFailedRequests: true,
			delayAfter: 0,
			delayMs: 1000,
			validate: false,
		})
		const next = jest.fn()

		instance(request, res, next)
		expect(next).not.toHaveBeenCalled()

		// `on-finish` ignores the close event on the req/res, and only listens for
		// it on the socket (?)
		request.socket.emit('close')
		request.emit('close')
		res.emit('close')

		jest.advanceTimersByTime(1001)
		expect(next).not.toHaveBeenCalled()
	})
})
