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

describe('key', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(global, 'setTimeout')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	it("should allow individual IP's to be reset", async () => {
		const instance = slowDown({
			delayMs: 100,
			delayAfter: 1,
			windowMs: 1000,
		})

		const ip = '1.2.3.4'

		await expectNoDelay(instance, { ip })
		await expectDelay(instance, 100, { ip })

		instance.resetKey(ip)
		;(setTimeout as any).mockClear()
		await expectNoDelay(instance, { ip })
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
})
