// /test/library/options-test.ts
// Tests the parsing/handling of options passed in by the user

import slowDown from '../../source/index.js'

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

	it('should throw an error when header options are used', () => {
		// @ts-expect-error Types don't allow this, by design.
		expect(() => slowDown({ standardHeaders: true })).toThrow(/headers/)
		// @ts-expect-error Ditto.
		expect(() => slowDown({ legacyHeaders: true })).toThrow(/headers/)
		// @ts-expect-error Ditto.
		expect(() => slowDown({ headers: true })).toThrow(/headers/)
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
})
