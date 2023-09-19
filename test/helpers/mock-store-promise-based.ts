import { Store } from 'express-rate-limit'

export class MockStorePromiseBased implements Store {
	this.store = {}
	this.incr_was_called = false
	this.resetKey_was_called = false
	this.decrement_was_called = false

	this.increment = (key) => {
		this.incr_was_called = true
		this.store[key] = (this.store[key] ?? 0) + 1

		return Promise.resolve({
			totalHits: this.store[key],
			resetTime: undefined,
		})
	}

	this.decrement = (key) => {
		this.decrement_was_called = true
		this.store[key] = (this.store[key] ?? 0) - 1
	}

	this.resetKey = (key) => {
		this.resetKey_was_called = true
		this.store[key] = 0
	}
}
