// /test/library/store-test.ts
// Tests the store with the middleware

import { jest } from '@jest/globals'
import slowDown from '../../source/index.js'
import {
	MockStore,
	MockLegacyStore,
	InvalidStore,
} from '../helpers/mock-stores.js'
import { expectNoDelay, expectNoDelayPromise } from '../helpers/requests.js'

describe('store', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.spyOn(global, 'setTimeout')
	})
	afterEach(() => {
		jest.useRealTimers()
		jest.restoreAllMocks()
	})

	describe('legacy store', () => {
		it('should not allow the use of a store that is not valid', async () => {
			expect(() => {
				const instance = slowDown({
					validate: false,
					store: new InvalidStore() as any,
				})

				console.log(instance)
				instance(
					{ ip: '1' } as any,
					{} as any,
					console.log.bind(console, 'next fn') as any,
				)
			}).toThrowError(/store/i)
		})

		it('should call incr on the store', async () => {
			const store = new MockLegacyStore()
			expect(store.incrementWasCalled).toBeFalsy()

			const instance = slowDown({
				validate: false,
				store,
			})
			await expectNoDelay(instance)
			expect(store.incrementWasCalled).toBeTruthy()
		})

		it('should call resetKey on the store', function () {
			const store = new MockLegacyStore()
			const limiter = slowDown({
				validate: false,
				store,
			})

			limiter.resetKey('key')
			expect(store.resetKeyWasCalled).toBeTruthy()
		})
	})

	describe('promise based store', () => {
		it('should call increment on the store', async () => {
			const store = new MockStore()
			expect(store.incrementWasCalled).toBeFalsy()

			const instance = slowDown({
				validate: false,
				store,
			})
			await expectNoDelayPromise(instance)
			expect(store.incrementWasCalled).toBeTruthy()
		})

		it('should call resetKey on the store', function () {
			const store = new MockStore()
			const limiter = slowDown({
				validate: false,
				store,
			})

			limiter.resetKey('key')
			expect(store.resetKeyWasCalled).toBeTruthy()
		})
	})
})
