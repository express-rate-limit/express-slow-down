import { LegacyStore, IncrementCallback } from 'express-rate-limit'

export function InvalidStore() {}

export class MockStore implements LegacyStore {
	incr_was_called = false
	resetKey_was_called = false
	decrement_was_called = false
	counter = 0

	incr(key: string, cb: IncrementCallback): void => {
		this.counter++
		this.incr_was_called = true

		cb(null, this.counter)
	}

	decrement(key: string): void => {
		// Console.log('decrementing')
		this.counter--
		this.decrement_was_called = true
	}

	resetKey(key: string): void => {
		this.resetKey_was_called = true
		this.counter = 0
	}
}
