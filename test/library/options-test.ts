// /test/library/options-test.ts
// Tests the parsing/handling of options passed in by the user

import slowDown from '../../source/index.js'

describe('options', () => {
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
})
