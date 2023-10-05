// /test/library/integration-test.ts
// Tests the middleware with a real Express application.

import EventEmitter from 'node:events'
// eslint-disable-next-line import/no-unassigned-import
import 'jest-expect-message'
import { type Application } from 'express'
import { agent as request } from 'supertest'
import slowDown from '../../source/index.js'
import { MockStore } from '../helpers/mock-stores.js'
import { createServer } from '../helpers/server.js'

/**
 * Makes the program wait for the given number of milliseconds.
 */
const sleep = async (milliseconds: number): Promise<void> =>
	// eslint-disable-next-line no-promise-executor-return
	new Promise((resolve) => setTimeout(resolve, milliseconds))

/**
 * Make a request to the default endpoint, and time it so we can check the
 * delay applied to the response.
 */
const makeTimedRequest = async (app: Application) => {
	const start = Date.now()
	await request(app)
		.get('/')
		.expect(200)
		.expect(/Hi there!/)
	return Date.now() - start
}

describe('integration', () => {
	it('should call incr on the store', async () => {
		const store = new MockStore()
		const app = createServer(
			slowDown({
				store,
				validate: false,
			}),
		)

		await request(app).get('/')
		expect(store.incrementWasCalled).toBeTruthy()
	})

	it('should call resetKey on the store', () => {
		const store = new MockStore()
		const limiter = slowDown({
			store,
			validate: false,
		})
		limiter.resetKey('key')

		expect(store.resetKeyWasCalled).toBeTruthy()
	})

	it('should allow the first request with minimal delay', async () => {
		const app = createServer(slowDown({ validate: false }))

		const delay = await makeTimedRequest(app)
		expect(delay, `First resp took too long: ${delay} ms.`).toBeLessThan(100)
	})

	it('should apply a small delay to the second request', async () => {
		const app = createServer(
			slowDown({
				delayMs: 100,
				validate: false,
			}),
		)

		let delay = await makeTimedRequest(app)
		expect(delay, `First resp took too long: ${delay} ms.`).toBeLessThan(100)

		delay = await makeTimedRequest(app)
		expect(
			delay,
			`Second resp was served too quickly: ${delay} ms.`,
		).toBeGreaterThanOrEqual(100)
		// Macos CI server is slow, and can add a 100-200ms of extra delay.
		expect(delay, `Second resp took too long: ${delay} ms.`).toBeLessThan(400)
	})

	it('should apply a larger delay to the subsequent request', async () => {
		const app = createServer(
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
		const delay = await makeTimedRequest(app)

		// Should be about 300ms delay on 4th request - because the multiplier starts at 0
		// BUT, this test frequently fails with a delay in the 4-500ms range on CI.
		// So, loosening up the range a bit here.
		expect(
			delay >= 250 && delay <= 600,
			`Fourth resp was served too fast or slow: ${delay} ms.`,
		).toBe(true)
	})

	it('should apply a cap of maxDelayMs on the the delay', async () => {
		const app = createServer(
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
		const delay = await makeTimedRequest(app)

		// Should cap the delay so the 4th request delays about 200ms instead of 300ms
		// this one also likes to fail with too much delay on macOS in CI
		expect(
			delay,
			`Fourth resp was served too fast: ${delay} ms.`,
		).toBeGreaterThanOrEqual(150)
		expect(delay, `Fourth resp was served too slow: ${delay} ms.`).toBeLessThan(
			600,
		)
	})

	it('should allow delayAfter requests before delaying responses', async () => {
		const app = createServer(
			slowDown({
				delayMs: 100,
				delayAfter: 2,
				validate: false,
			}),
		)

		let delay = await makeTimedRequest(app)
		expect(delay, `First resp was served too slow: ${delay} ms.`).toBeLessThan(
			50,
		)

		delay = await makeTimedRequest(app)
		expect(delay, `Second resp was served too slow: ${delay} ms.`).toBeLessThan(
			50,
		)

		delay = await makeTimedRequest(app)
		expect(
			delay > 50 && delay < 150,
			`Third request outside of range: ${delay} ms.`,
		).toBe(true)
	})

	it('should allow delayAfter to be a function', async () => {
		const app = createServer(
			slowDown({
				delayMs: 100,
				delayAfter: () => 2,
				validate: false,
			}),
		)

		let delay = await makeTimedRequest(app)
		expect(delay, `First resp was served too slow: ${delay} ms.`).toBeLessThan(
			50,
		)

		delay = await makeTimedRequest(app)
		expect(delay, `Second resp was served too slow: ${delay} ms.`).toBeLessThan(
			50,
		)

		delay = await makeTimedRequest(app)
		expect(
			delay > 50 && delay < 150,
			`Third request outside of range: ${delay} ms.`,
		).toBe(true)
	})

	it('should (eventually) return to full speed', async () => {
		const app = createServer(
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

		const delay = await makeTimedRequest(app)
		expect(delay, `Fourth resp was served too slow: ${delay} ms.`).toBeLessThan(
			50,
		)
	})

	it('should work repeatedly (issues #2 & #3)', async () => {
		const app = createServer(
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

		let delay = await makeTimedRequest(app)
		expect(delay, `Fourth resp was served too slow: ${delay} ms.`).toBeLessThan(
			50,
		)

		await Promise.all([
			request(app).get('/'), // 1st - no delay
			request(app).get('/'), // 2nd - 100ms delay
		])
		await sleep(60)

		delay = await makeTimedRequest(app)
		expect(
			delay,
			`Eventual resp was served too slow: ${delay} ms.`,
		).toBeLessThan(50)
	})

	it('should allow individual IP to be reset', async () => {
		const limiter = slowDown({
			delayMs: 100,
			delayAfter: 1,
			windowMs: 50,
			validate: false,
		})
		const app = createServer(limiter)

		const response = await request(app).get('/ip').expect(204)

		const myIp = response.headers['x-your-ip']
		if (!myIp) throw new Error('Unable to determine local IP')

		await request(app).get('/') // 1st - no delay
		await request(app).get('/') // 2nd - 100ms delay

		limiter.resetKey(myIp)
		await request(app).get('/') // 3rd - but no delay
	})

	it('should allow custom key generators', async () => {
		const limiter = slowDown({
			delayMs: 0,
			delayAfter: 2,
			keyGenerator: (request) => request.query.key as string,
			validate: false,
		})
		const app = createServer(limiter)

		await request(app).get('/?key=1') // 1st - no delay
		await request(app).get('/?key=1') // 2nd - 100ms delay
		await request(app).get('/?key=2') // 1st - no delay
		await request(app).get('/?key=1') // 3rd - 100ms delay
		await request(app).get('/?key=2') // 2nd - 100ms delay
		await request(app).get('/?key=2') // 3rd - 100ms delay
	})

	it('should allow custom skip function', async () => {
		const limiter = slowDown({
			delayMs: 0,
			delayAfter: 2,
			skip: () => true,
			validate: false,
		})
		const app = createServer(limiter)

		await request(app).get('/')
		await request(app).get('/')
		await request(app).get('/') // 3rd request would normally fail but we're skipping it
	})

	it('should decrement hits with success response and skipSuccessfulRequests', async () => {
		const store = new MockStore()
		const app = createServer(
			slowDown({
				skipSuccessfulRequests: true,
				store,
				validate: false,
			}),
		)

		await request(app).get('/')
		expect(
			store.decrementWasCalled,
			'`decrement` was not called on the store',
		).toBeTruthy()
	})

	it('should decrement hits with failed response and skipFailedRequests', async () => {
		const store = new MockStore()
		const app = createServer(
			slowDown({
				skipFailedRequests: true,
				store,
				validate: false,
			}),
		)

		await request(app).get('/error').expect(400)
		expect(
			store.decrementWasCalled,
			'`decrement` was not called on the store',
		).toBeTruthy()
	})

	it('should decrement hits with closed response and skipFailedRequests', async () => {
		const store = new MockStore()

		const requestMock = {}
		const responseMock = new EventEmitter()
		const nextFn = () => {} // eslint-disable-line @typescript-eslint/no-empty-function
		const middleware = slowDown({
			skipFailedRequests: true,
			store,
			validate: false,
		})

		// eslint-disable-next-line @typescript-eslint/await-thenable
		await middleware(requestMock as any, responseMock as any, nextFn)
		responseMock.emit('close')

		// eslint-disable-next-line no-promise-executor-return
		await new Promise((resolve) => setTimeout(resolve, 200))
		expect(
			store.decrementWasCalled,
			'`decrement` was not called on the store',
		).toBeTruthy()
	})

	it('should decrement hits with response emitting error and skipFailedRequests', async () => {
		const store = new MockStore()
		const app = createServer(
			slowDown({
				skipFailedRequests: true,
				store,
				validate: false,
			}),
		)

		await request(app).get('/crash')
		expect(
			store.decrementWasCalled,
			'`decrement` was not called on the store',
		).toBeTruthy()
	})

	it('should not decrement hits with success response and skipFailedRequests', async () => {
		const store = new MockStore()
		const app = createServer(
			slowDown({
				skipFailedRequests: true,
				store,
				validate: false,
			}),
		)

		await request(app).get('/')
		expect(
			store.decrementWasCalled,
			'`decrement` was called on the store',
		).toBeFalsy()
	})

	it('should not excute slow down timer in case of req closed during delay', async () => {
		const requestMock = {}
		const responseMock = new EventEmitter()
		const middleware = slowDown({
			delayAfter: 0,
			delayMs: 100,
			windowMs: 1000,
			validate: false,
		})
		const nextFn = () => {
			throw new Error('`setTimeout` should not excute!')
		}

		// eslint-disable-next-line @typescript-eslint/await-thenable
		await middleware(requestMock as any, responseMock as any, nextFn)
		responseMock.emit('close')

		// eslint-disable-next-line no-promise-executor-return
		await new Promise((resolve) => setTimeout(resolve, 200))
	})

	// TODO: it('should not excute slow down timer in case req is closed before delay begins')
})
