// /test/instance-api-test.ts
// Tests the instance API

import { jest } from '@jest/globals'
import slowDown from '../source/index.js'
import { expectDelay, expectNoDelay } from './helpers/requests.js'

describe('instance-api', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(global, 'setTimeout')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	it('should allow individual IPs to be reset', async () => {
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
})
