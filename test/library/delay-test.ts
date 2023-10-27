// /test/library/delay-test.ts
// Tests the delaying mechanism

import { jest } from '@jest/globals'
import slowDown from '../../source/index.js'
import { expectDelay, expectNoDelay } from '../helpers/requests.js'

describe('slowdown', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(global, 'setTimeout')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	it('should not delay the first request', async () => {
		const instance = slowDown({
			validate: false,
			delayAfter: 1,
		})

		await expectNoDelay(instance)
	})

	it('should delay the first request', async () => {
		const instance = slowDown({
			validate: false,
			delayAfter: 0,
			delayMs: 100,
		})

		await expectDelay(instance, 100)
	})

	it('should apply a larger delay to each subsequent request', async () => {
		const instance = slowDown({
			validate: false,
			delayAfter: 0,
			delayMs: (used: number) => used * 100,
		})

		await expectDelay(instance, 100)
		await expectDelay(instance, 200)
		await expectDelay(instance, 300)
	})

	it('should apply a cap of maxDelayMs on the the delay', async () => {
		const instance = slowDown({
			validate: false,
			delayAfter: 0,
			delayMs: (used: number) => used * 100,
			maxDelayMs: 250,
		})

		await expectDelay(instance, 100)
		await expectDelay(instance, 200)
		await expectDelay(instance, 250)
		await expectDelay(instance, 250)
		await expectDelay(instance, 250)
		await expectDelay(instance, 250)
	})

	it('should allow delayAfter requests before delaying', async () => {
		const instance = slowDown({
			validate: false,
			delayAfter: 2,
			delayMs: 300,
		})

		await expectNoDelay(instance)
		await expectNoDelay(instance)
		await expectDelay(instance, 300)
	})

	it('should (eventually) return to full speed', async () => {
		const instance = slowDown({
			validate: false,
			delayMs: 100,
			delayAfter: 1,
			windowMs: 300,
		})

		await expectNoDelay(instance)
		await expectDelay(instance, 100)

		jest.advanceTimersByTime(200)
		;(setTimeout as any).mockClear()

		await expectNoDelay(instance)
	})

	it('should work repeatedly (issues #2 & #3)', async () => {
		const instance = slowDown({
			validate: false,
			delayMs: 100,
			delayAfter: 2,
			windowMs: 50,
		})

		await expectNoDelay(instance)
		await expectNoDelay(instance)
		await expectDelay(instance, 100) // Note: window is reset twice in this time
		;(setTimeout as any).mockClear()

		await expectNoDelay(instance)
		await expectNoDelay(instance)
		await expectDelay(instance, 100)
		;(setTimeout as any).mockClear()

		await expectNoDelay(instance)
	})
})
