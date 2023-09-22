import { type LegacyStore, type IncrementCallback } from 'express-rate-limit'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class InvalidStore {}

export class MockStore implements LegacyStore {
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
		// Console.log('decrementing')
		this.counter--
		this.decrementWasCalled = true
	}

	resetKey(key: string): void {
		this.resetKeyWasCalled = true
		this.counter = 0
	}
}
