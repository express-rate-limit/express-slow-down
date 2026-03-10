// /test/library/options-test.ts
// Tests the parsing/handling of options passed in by the user

import slowDown from '../../source/index.js'
import { expectNoDelay } from '../helpers/requests.js'

describe('options', () => {
	beforeEach(() => {
		jest.spyOn(console, 'error').mockImplementation(() => {})
		jest.spyOn(console, 'warn').mockImplementation(() => {})
	})
	afterEach(() => {
		jest.restoreAllMocks()
	})

	it('should not modify the options object passed', () => {
		const options = {}
		slowDown(options)

		expect(options).toStrictEqual({})
	})

	it('should allow header options to be enabled', () => {
		expect(() => slowDown({ standardHeaders: true })).not.toThrow()
		expect(() => slowDown({ legacyHeaders: true })).not.toThrow()
		expect(() =>
			slowDown({ standardHeaders: 'draft-6', legacyHeaders: true }),
		).not.toThrow()
	})

	it('should have headers disabled by default', async () => {
		jest.spyOn(global, 'setTimeout')
		const instance = slowDown({ delayAfter: 1, validate: false })
		const response = await expectNoDelay(instance)
		expect(response.headers['x-ratelimit-limit']).toBeUndefined()
		expect(response.headers['ratelimit-limit']).toBeUndefined()
	})

	it('should send standard headers when standardHeaders is enabled', async () => {
		jest.spyOn(global, 'setTimeout')
		const instance = slowDown({
			delayAfter: 5,
			standardHeaders: 'draft-6',
			validate: false,
		})
		const response = await expectNoDelay(instance)
		expect(response.headers['ratelimit-limit']).toBeDefined()
	})

	it('should send legacy headers when legacyHeaders is enabled', async () => {
		jest.spyOn(global, 'setTimeout')
		const instance = slowDown({
			delayAfter: 5,
			legacyHeaders: true,
			validate: false,
		})
		const response = await expectNoDelay(instance)
		expect(response.headers['x-ratelimit-limit']).toBeDefined()
	})

	it('should throw an error when max option is used', () => {
		// @ts-expect-error Types don't allow this, by design.
		expect(() => slowDown({ max: 3 })).toThrow(/delayAfter/)
		// @ts-expect-error Ditto.
		expect(() => slowDown({ limit: 3 })).toThrow(/delayAfter/)
	})

	it('should warn about delayMs being a number', () => {
		slowDown({ delayMs: 100 })
		expect(console.warn).toBeCalled()
	})

	it('should not warn about delayMs being a number if validate is false', () => {
		slowDown({ delayMs: 100, validate: false })
		expect(console.warn).not.toBeCalled()
		expect(console.error).not.toBeCalled()
	})

	it('should not warn about delayMs being a number if validate.delayMs is false', () => {
		slowDown({ delayMs: 100, validate: { delayMs: false } })
		expect(console.warn).not.toBeCalled()
		expect(console.error).not.toBeCalled()
	})

	it('should not warn about max being zero when validate.delayMs is false', async () => {
		jest.spyOn(global, 'setTimeout')
		const instance = slowDown({
			delayAfter: 1,
			delayMs: 100,
			validate: { delayMs: false },
		})
		await expectNoDelay(instance)
		expect(console.warn).not.toBeCalled()
		expect(console.error).not.toBeCalled()
	})
})
