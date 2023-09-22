import EventEmitter from 'node:events'
import {
	describe,
	expect,
	beforeEach,
	afterEach,
	jest,
	it,
} from '@jest/globals'
import slowDown from '../source/express-slow-down'

describe('Connection closed during delay tests', () => {
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
		// Gotta do a bunch of sillyness to convinve it the request isn't finished at the start
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

		request.socket.emit('close') // On-finish ignores the close event on the req/res, and only listens for it on the socket (?)
		request.emit('close')
		res.emit('close')
		// Req.emit('end');

		jest.advanceTimersByTime(1001)

		expect(next).not.toHaveBeenCalled()
	})
})
