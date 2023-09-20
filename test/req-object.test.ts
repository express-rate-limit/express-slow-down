import {
	describe,
	expect,
	beforeEach,
	afterEach,
	jest,
	it,
} from '@jest/globals'
import slowDown from '../source/express-slow-down'
import { expectNoDelay } from './helpers/requests'

describe('req augmentation', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(global, 'setTimeout')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
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
			// ResetTime: Date object
		})
	})
})