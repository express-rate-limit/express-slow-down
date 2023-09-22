import { type Store } from 'express-rate-limit'

export class MockStorePromiseBased implements Store {
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
