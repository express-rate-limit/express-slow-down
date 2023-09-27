// /test/options-test.ts
// Tests the parsing/handling of options passed in by the user

import slowDown from '../source/index.js'

describe('options', () => {
	it('should not modify the options object passed', () => {
		const options = {}
		slowDown(options)

		expect(options).toStrictEqual({})
	})
})
