import { LegacyStore } from 'express-rate-limit'

export function InvalidStore() {}

export class MockStore implements LegacyStore {
	this.incr_was_called = false
	this.resetKey_was_called = false
	this.decrement_was_called = false
	this.counter = 0

	this.incr = (key, cb) => {
		this.counter++
		this.incr_was_called = true

		cb(null, this.counter)
	}

	this.decrement = () => {
		// Console.log('decrementing')
		this.counter--
		this.decrement_was_called = true
	}

	this.resetKey = () => {
		this.resetKey_was_called = true
		this.counter = 0
	}
}
