// /test/library/middleware-test.ts
// Tests the middleware by passing in various options to it

import EventEmitter from 'node:events'
import { jest } from '@jest/globals'
import slowDown from '../../source/index.js'
import { expectDelay, expectNoDelay } from '../helpers/requests.js'
import { MockStore } from '../helpers/mock-stores.js'

describe('middleware behaviour', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(global, 'setTimeout')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	it('should allow delayAfter to be a function', async () => {
		const instance = slowDown({
			delayAfter: () => 2,
			delayMs: 99,
		})
		await expectNoDelay(instance)
		await expectNoDelay(instance)
		await expectDelay(instance, 99)
	})

	it('should allow delayMs to be a function', async () => {
		const instance = slowDown({
			delayAfter: 1,
			delayMs: () => 99,
		})
		await expectNoDelay(instance)
		await expectDelay(instance, 99)
	})

	it('should allow maxDelayMs to be a function', async () => {
		const instance = slowDown({
			delayAfter: 1,
			delayMs: (used: number) => (used - 1) * 100,
			maxDelayMs: () => 200,
		})
		await expectNoDelay(instance)
		await expectDelay(instance, 100)
		await expectDelay(instance, 200)
		await expectDelay(instance, 200)
	})

	it('should allow a custom key generator', async () => {
		const keyGenerator = jest.fn() as any
		const instance = slowDown({
			delayAfter: 1,
			keyGenerator,
		})

		await expectNoDelay(instance)
		expect(keyGenerator).toHaveBeenCalled()
	})

	it('should allow a custom skip function', async () => {
		const skip = jest
			.fn()
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(true) as any
		const instance = slowDown({
			delayAfter: 0,
			delayMs: 100,
			skip,
		})
		await expectDelay(instance, 100)
		expect(skip).toHaveBeenCalled()
		;(setTimeout as any).mockClear()
		await expectNoDelay(instance)
		expect(skip).toHaveBeenCalledTimes(2)
	})

	it('should decrement hits with success response and skipSuccessfulRequests', async () => {
		const request = {}
		const res: any = new EventEmitter()
		jest.spyOn(res, 'on')
		const store = new MockStore()
		const instance = slowDown({
			skipSuccessfulRequests: true,
			store,
		})
		await expectNoDelay(instance, request, res)
		expect(store.decrementWasCalled).toBeFalsy()
		expect(res.on).toHaveBeenCalled()

		res.statusCode = 200
		res.emit('finish')
		expect(store.decrementWasCalled).toBeTruthy()
	})

	it('should not decrement hits with error response and skipSuccessfulRequests', async () => {
		const request = {}
		const res: any = new EventEmitter()
		const store = new MockStore()
		const instance = slowDown({
			skipSuccessfulRequests: true,
			store,
		})
		await expectNoDelay(instance, request, res)

		res.statusCode = 400
		res.emit('finish')
		expect(store.decrementWasCalled).toBeFalsy()
	})

	it('should not decrement hits with success response and skipFailedRequests', async () => {
		const request = {}
		const res: any = new EventEmitter()
		jest.spyOn(res, 'on')
		const store = new MockStore()
		const instance = slowDown({
			skipFailedRequests: true,
			store,
		})
		await expectNoDelay(instance, request, res)
		expect(res.on).toHaveBeenCalled()

		res.statusCode = 200
		res.emit('finish')
		expect(store.decrementWasCalled).toBeFalsy()
	})

	it('should decrement hits with error status code and skipFailedRequests', async () => {
		const request = {}
		const res: any = new EventEmitter()
		const store = new MockStore()
		const instance = slowDown({
			skipFailedRequests: true,
			store,
		})
		await expectNoDelay(instance, request, res)
		expect(store.decrementWasCalled).toBeFalsy()

		res.statusCode = 400
		res.emit('finish')
		expect(store.decrementWasCalled).toBeTruthy()
	})

	it('should decrement hits with closed unfinished response and skipFailedRequests', async () => {
		const request = {}
		const res: any = new EventEmitter()
		const store = new MockStore()
		const instance = slowDown({
			skipFailedRequests: true,
			store,
		})
		await expectNoDelay(instance, request, res)
		expect(store.decrementWasCalled).toBeFalsy()

		res.finished = false
		res.emit('close')
		expect(store.decrementWasCalled).toBeTruthy()
	})

	it('should decrement hits with error event on response and skipFailedRequests', async () => {
		const request = {}
		const res: any = new EventEmitter()
		const store = new MockStore()
		const instance = slowDown({
			skipFailedRequests: true,
			store,
		})
		await expectNoDelay(instance, request, res)
		expect(store.decrementWasCalled).toBeFalsy()

		res.emit('error')
		expect(store.decrementWasCalled).toBeTruthy()
	})

	it('should augment the req object with info about the slowdown status', async () => {
		const request: any = {}
		const instance = slowDown({
			delayAfter: 2,
			windowMs: 1000,
		})
		await expectNoDelay(instance, request)
		expect(request.slowDown).toMatchObject({
			current: 1,
			delay: 0,
			limit: 2,
			remaining: 1,
			resetTime: expect.any(Date),
		})
	})
})
