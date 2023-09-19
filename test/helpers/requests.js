const EventEmitter = require('node:events')

function makeRequestPassValidation(request) {
	request.ip = '1.2.3.4'
	request.app = {
		get: () => false,
	}
	request.headers = []
}

// These helpers expect timers to be mocked and setTimeout to be spied on

async function expectNoDelay(
	instance,
	request = new EventEmitter(),
	res = new EventEmitter(),
) {
	const next = jest.fn()
	makeRequestPassValidation(request)
	await instance(request, res, next)
	expect(setTimeout).not.toHaveBeenCalled()
	expect(next).toHaveBeenCalled()
}

async function expectDelay(
	instance,
	expectedDelay,
	request = new EventEmitter(),
	res = new EventEmitter(),
) {
	const next = jest.fn()
	makeRequestPassValidation(request)

	// Set the timeout
	await instance(request, res, next)
	expect(setTimeout).toHaveBeenCalled()
	expect(next).not.toHaveBeenCalled()

	// Wait for it...
	jest.advanceTimersByTime(expectedDelay - 1)
	expect(next).not.toHaveBeenCalled()

	// Now!
	jest.advanceTimersByTime(1)
	expect(next).toHaveBeenCalled()
}

module.exports = {
	expectNoDelay,
	expectNoDelayPromise: expectNoDelay,
	expectDelay,
}
