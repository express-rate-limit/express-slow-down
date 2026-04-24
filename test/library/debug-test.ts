import { jest } from '@jest/globals'
import slowDown from '../../source/index.js'
import { expectNoDelay } from '../helpers/requests.js'

describe('debug option', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(console, 'log').mockImplementation(() => {})
		jest.spyOn(global, 'setTimeout')
	})

	afterEach(() => {
		jest.restoreAllMocks()
		jest.useRealTimers()
	})

	it('should log information when debug is enabled', async () => {
		const instance = slowDown({
			delayAfter: 1,
			delayMs: 100,
			debug: true,
		})

		await expectNoDelay(instance)
		expect(console.log).toHaveBeenCalledWith(
			expect.stringContaining('express-slow-down: request from 1.2.3.4'),
		)
	})

	it('should not log information when debug is disabled', async () => {
		const instance = slowDown({
			delayAfter: 1,
			delayMs: 100,
			debug: false,
		})

		await expectNoDelay(instance)
		expect(console.log).not.toHaveBeenCalled()
	})
})
