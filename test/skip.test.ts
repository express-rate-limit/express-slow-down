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
import { expectDelay, expectNoDelay } from './helpers/requests'
import { MockStore } from './helpers/mock-store'

describe('request skipping', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(global, 'setTimeout')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	// Skip

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

	// SkipSuccessfulRequests

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

	// SkipFailedRequests

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
})
