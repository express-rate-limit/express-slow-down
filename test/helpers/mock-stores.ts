// /test/helpers/mock-stores.ts
// Declares and exports legacy and modern stores to use with the middleware

import type { Store, LegacyStore, IncrementCallback } from 'express-rate-limit'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class InvalidStore {}

export class MockStore implements Store {
	store: { [key: string]: number } = {}
	incrWasCalled = false
	resetKeyWasCalled = false
	decrementWasCalled = false

	async increment(key: string) {
		this.incrWasCalled = true
		this.store[key] = (this.store[key] ?? 0) + 1

		return {
			totalHits: this.store[key],
			resetTime: undefined,
		}
	}

	decrement(key: string) {
		this.decrementWasCalled = true
		this.store[key] = (this.store[key] ?? 0) - 1
	}

	resetKey(key: string) {
		this.resetKeyWasCalled = true
		this.store[key] = 0
	}
}

export class MockLegacyStore implements LegacyStore {
	incrWasCalled = false
	resetKeyWasCalled = false
	decrementWasCalled = false
	counter = 0

	incr(key: string, cb: IncrementCallback): void {
		this.counter++
		this.incrWasCalled = true

		cb(undefined, this.counter, new Date())
	}

	decrement(key: string): void {
		this.counter--
		this.decrementWasCalled = true
	}

	resetKey(key: string): void {
		this.resetKeyWasCalled = true
		this.counter = 0
	}
}
