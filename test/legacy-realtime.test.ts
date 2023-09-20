import assert from 'node:assert'
import eventEmitter from 'node:events'
import express, { type Application } from 'express'
import request from 'supertest'
import { describe, beforeEach, it } from '@jest/globals'
import slowDown from '../source/express-slow-down'
import type { SlowDownRequestHandler } from '../source/types'
import { MockStore, InvalidStore } from './helpers/mock-store'

describe('legacy realtime tests', function () {
	let app!: Application
	let longResponseClosed!: boolean

	beforeEach(function () {
		longResponseClosed = false
	})

	function createAppWith(limit: SlowDownRequestHandler): Application {
		app = express()
		app.all('/', limit, function (request_, res) {
			res.send('response!')
		})
		// Helper endpoint to know what ip test requests come from
		// set in headers so that I don't have to deal with the body being a stream
		app.get('/ip', function (request_, res) {
			res.setHeader('x-your-ip', request_.ip)
			res.status(204).send('')
		})

		app.all('/bad_response_status', limit, function (request_, res) {
			res.status(403).send()
		})
		app.all('/long_response', limit, function (request_, res) {
			const timerId = setTimeout(() => res.send('response!'), 100)
			res.on('close', () => {
				longResponseClosed = true

				clearTimeout(timerId)
			})
		})
		app.all('/response_emit_error', limit, function (request_, res) {
			res.on('error', () => {
				res.end()
			})
			res.emit('error', new Error())
		})
		return app
	}

	function fastRequest(errorHandler: any, successHandler?: any, key?: any) {
		let request_ = request(app).get('/')
		// Add optional key parameter
		if (key) {
			request_ = request_.query({ key })
		}

		request_
			.expect(200)
			.expect(/response!/)
			.end(function (error, res) {
				if (error) {
					return errorHandler(error)
				}

				if (successHandler) {
					successHandler(null, res)
				}
			})
	}

	// For the moment, we're not checking the speed within the response. but this should make it easy to add that check later.
	const slowRequest = fastRequest

	async function timedRequest() {
		const start = Date.now()
		await request(app)
			.get('/')
			.expect(200)
			.expect(/response!/)
		return Date.now() - start
	}

	async function sleep(t: number) {
		return new Promise((resolve) => setTimeout(resolve, t))
	}

	// todo: figure out why this test is failing - it might be a real bug
	it.skip('should not allow the use of a store that is not valid', function (done) {
		try {
			slowDown({
				store: InvalidStore() as any,
			})
		} catch {
			return done()
		}

		done(new Error('It allowed an invalid store'))
	})

	it('should call incr on the store', async () => {
		const store = new MockStore()
		assert(!store.incr_was_called)

		createAppWith(
			slowDown({
				store,
				validate: false,
			}),
		)

		await request(app).get('/')
		assert(store.incr_was_called)
	})

	it('should call resetKey on the store', function () {
		const store = new MockStore()
		const limiter = slowDown({
			store,
			validate: false,
		})
		limiter.resetKey('key')
		assert(store.resetKey_was_called)
	})

	it('should allow the first request with minimal delay', async function () {
		createAppWith(slowDown({ validate: false }))
		const delay = await timedRequest()
		assert(delay < 100, 'First request took too long: ' + delay + 'ms')
	})

	it('should apply a small delay to the second request', async function () {
		createAppWith(
			slowDown({
				delayMs: 100,
				validate: false,
			}),
		)
		let delay = await timedRequest()
		assert(delay < 100, 'First request took too long: ' + delay + 'ms')
		delay = await timedRequest()
		assert(delay >= 100, 'Second request was served too fast: ' + delay + 'ms')
		// Macos CI server is slow, and can add a 100-200ms of extra delay
		assert(delay < 400, 'Second request took too long: ' + delay + 'ms')
	})

	it('should apply a larger delay to the subsequent request', async function () {
		createAppWith(
			slowDown({
				delayMs: (used) => (used - 1) * 100,
				validate: false,
			}),
		)
		await Promise.all([
			request(app).get('/'), // No delay
			request(app).get('/'), // 100ms delay
			request(app).get('/'), // 200ms delay
		])
		const delay = await timedRequest()
		// Should be about 300ms delay on 4th request - because the multiplier starts at 0
		// BUT, this test frequently fails with a delay in the 4-500ms range on CI.
		// So, loosening up the range a bit here.
		assert(
			delay >= 250 && delay <= 600,
			'Fourth request was served too fast or slow: ' + delay + 'ms',
		)
	})

	it('should apply a cap of maxDelayMs on the the delay', async function () {
		createAppWith(
			slowDown({
				delayAfter: 1,
				delayMs: (used) => (used - 1) * 100,
				maxDelayMs: 200,
				validate: false,
			}),
		)
		await Promise.all([
			request(app).get('/'), // 1st - no delay
			request(app).get('/'), // 2nd - 100ms delay
			request(app).get('/'), // 3rd - 200ms delay
		])

		const delay = await timedRequest()

		// Should cap the delay so the 4th request delays about 200ms instead of 300ms
		// this one also likes to fail with too much delay on macOS in CI
		assert(delay >= 150, 'Fourth request was served too fast: ' + delay + 'ms')
		assert(delay < 600, 'Fourth request took too long: ' + delay + 'ms')
	})

	it('should allow delayAfter requests before delaying responses', async function () {
		createAppWith(
			slowDown({
				delayMs: 100,
				delayAfter: 2,
				validate: false,
			}),
		)
		let delay = await timedRequest()
		assert(delay < 50, 'First request took too long: ' + delay + 'ms')

		delay = await timedRequest()
		assert(delay < 50, 'Second request took too long: ' + delay + 'ms')

		delay = await timedRequest()
		assert(
			delay > 50 && delay < 150,
			'Third request outside of range: ' + delay + 'ms',
		)
	})

	it('should allow delayAfter to be a function', async function () {
		createAppWith(
			slowDown({
				delayMs: 100,
				delayAfter: () => 2,
				validate: false,
			}),
		)
		let delay = await timedRequest()
		assert(delay < 50, 'First request took too long: ' + delay + 'ms')

		delay = await timedRequest()
		assert(delay < 50, 'Second request took too long: ' + delay + 'ms')

		delay = await timedRequest()
		assert(
			delay > 50 && delay < 150,
			'Third request outside of range: ' + delay + 'ms',
		)
	})

	it('should (eventually) return to full speed', async function () {
		createAppWith(
			slowDown({
				delayMs: 100,
				delayAfter: 1,
				windowMs: 50,
				validate: false,
			}),
		)
		await Promise.all([
			request(app).get('/'), // 1st - no delay
			request(app).get('/'), // 2nd - 100ms delay
			request(app).get('/'), // 3rd - 200ms delay
		])

		await sleep(500)

		const delay = await timedRequest()
		assert(delay < 50, 'Fourth request took too long: ' + delay + 'ms')
	})

	it('should work repeatedly (issues #2 & #3)', async function () {
		createAppWith(
			slowDown({
				delayMs: 100,
				delayAfter: 2,
				windowMs: 50,
				validate: false,
			}),
		)

		await Promise.all([
			request(app).get('/'), // 1st - no delay
			request(app).get('/'), // 2nd - 100ms delay
			request(app).get('/'), // 3rd - 200ms delay
		])

		await sleep(60)

		let delay = await timedRequest()
		assert(delay < 50, 'Fourth request took too long: ' + delay + 'ms')

		await Promise.all([
			request(app).get('/'), // 1st - no delay
			request(app).get('/'), // 2nd - 100ms delay
		])

		await sleep(60)

		delay = await timedRequest()
		assert(delay < 50, 'Eventual request took too long: ' + delay + 'ms')
	})

	it("should allow individual IP's to be reset", function (done) {
		const limiter = slowDown({
			delayMs: 100,
			delayAfter: 1,
			windowMs: 50,
			validate: false,
		})
		createAppWith(limiter)

		request(app)
			.get('/ip')
			.expect(204)
			.end(function (error, res) {
				const myIp = res.headers['x-your-ip']
				if (!myIp) {
					return done(new Error('unable to determine local IP'))
				}

				fastRequest(done)
				slowRequest(done, function (error: any) {
					if (error) {
						return done(error)
					}

					limiter.resetKey(myIp)
					fastRequest(done, done)
				})
			})
	})

	it('should allow custom key generators', function (done) {
		const limiter = slowDown({
			delayMs: 0,
			delayAfter: 2,
			keyGenerator(request_, res) {
				assert.ok(request_)
				assert.ok(res)

				const { key } = request_.query
				assert.ok(key)

				return key as string
			},
			validate: false,
		})

		createAppWith(limiter)
		fastRequest(done, null, 1)
		fastRequest(done, null, 1)
		fastRequest(done, null, 2)
		slowRequest(
			done,
			function (error: any) {
				if (error) {
					return done(error)
				}

				fastRequest(done, null, 2)
				slowRequest(done, done, 2)
			},
			1,
		)
	})

	it('should allow custom skip function', function (done) {
		const limiter = slowDown({
			delayMs: 0,
			delayAfter: 2,
			skip(request_, res) {
				assert.ok(request_)
				assert.ok(res)

				return true
			},
			validate: false,
		})

		createAppWith(limiter)
		fastRequest(done, null, 1)
		fastRequest(done, null, 1)
		fastRequest(done, done, 1) // 3rd request would normally fail but we're skipping it
	})

	it('should decrement hits with success response and skipSuccessfulRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			slowDown({
				skipSuccessfulRequests: true,
				store,
				validate: false,
			}),
		)
		fastRequest(done, function () {
			if (store.decrement_was_called) {
				done()
			} else {
				done(new Error('decrement was not called on the store'))
			}
		})
	})
	it('should decrement hits with failed response and skipFailedRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			slowDown({
				skipFailedRequests: true,
				store,
				validate: false,
			}),
		)
		request(app)
			.get('/bad_response_status')
			.expect(403)
			.end(() => {
				if (store.decrement_was_called) {
					done()
				} else {
					done(new Error('decrement was not called on the store'))
				}
			})
	})
	// After upgrading super test, this one always fails, because res.finished is set to true, despite the response never actually being sent
	// skip.test.js has an equivalent test hat doesn't use supertest and passes
	it.skip('should decrement hits with closed response and skipFailedRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			slowDown({
				skipFailedRequests: true,
				store,
				validate: false,
			}),
		)
		const checkStoreDecremented = () => {
			if (longResponseClosed) {
				if (store.decrement_was_called) {
					done()
				} else {
					done(new Error('decrement was not called on the store'))
				}
			} else {
				setImmediate(checkStoreDecremented)
			}
		}

		request(app).get('/long_response').timeout(10).end(checkStoreDecremented)
	})
	it('should decrement hits with response emitting error and skipFailedRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			slowDown({
				skipFailedRequests: true,
				store,
				validate: false,
			}),
		)
		request(app)
			.get('/response_emit_error')
			.end(() => {
				if (store.decrement_was_called) {
					done()
				} else {
					done(new Error('decrement was not called on the store'))
				}
			})
	})

	it('should not decrement hits with success response and skipFailedRequests', (done) => {
		const store = new MockStore()
		createAppWith(
			slowDown({
				skipFailedRequests: true,
				store,
				validate: false,
			}),
		)

		fastRequest(done, function () {
			if (store.decrement_was_called) {
				done(new Error('decrement was called on the store'))
			} else {
				done()
			}
		})
	})

	it('should decrement hits with a failure and skipFailedRequests', (done) => {
		const store = new MockStore()
		const app = createAppWith(
			slowDown({
				store,
				skipFailedRequests: true,
				validate: false,
			}),
		)
		request(app)
			.get('/bad_response_status')
			.expect(403)
			.end(function (error: any /* , res */) {
				if (error) {
					return done(error)
				}

				if (store.decrement_was_called) {
					done()
				} else {
					done(new Error('decrement was not called on the store'))
				}
			})
	})

	it('should not excute slow down timer in case of req closed during delay', async () => {
		const requestMock = {}
		const resMock = new eventEmitter()
		const currentLimiterMiddleWare = slowDown({
			delayAfter: 0,
			delayMs: 100,
			windowMs: 1000,
			validate: false,
		})
		function next() {
			throw new Error('setTimeout should not excute!')
		}

		await currentLimiterMiddleWare(requestMock as any, resMock as any, next)
		resMock.emit('close')

		await new Promise((resolve) => setTimeout(resolve, 200))
	})

	// Todo: it("should not excute slow down timer in case of req closed before delay begins", async () => {
})
