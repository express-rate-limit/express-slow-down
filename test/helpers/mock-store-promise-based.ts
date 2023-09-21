import { type Store } from 'express-rate-limit'

export class MockStorePromiseBased implements Store {
	store: { [key: string]: number } = {}
	incr_was_called = false
	resetKey_was_called = false
	decrement_was_called = false

	async increment(key: string) {
		this.incr_was_called = true
		this.store[key] = (this.store[key] ?? 0) + 1

		return {
			totalHits: this.store[key],
			resetTime: undefined,
		}
	}

	decrement(key: string) {
		this.decrement_was_called = true
		this.store[key] = (this.store[key] ?? 0) - 1
	}

	resetKey(key: string) {
		this.resetKey_was_called = true
		this.store[key] = 0
	}
}
