// /test/real-world-test.ts
// Tests the middleware in real world scenarios

import { describe, it } from '@jest/globals'
import createServer from 'express'
import { agent as request } from 'supertest'
import { json } from 'body-parser'
import slowDown from '../source/index.js'
import { MockStore } from './helpers/mock-stores.js'

describe('real-world', () => {
	it('should handle a req being processed before `express-slow-down` (#31 & #32)', async () => {
		const app = createServer()

		// Note: in real-world usabe, body parser middleware should come AFTER
		// `express-slow-down`.
		app.use(json({ limit: '50mb' }))

		app.use(
			slowDown({
				delayAfter: 0,
				delayMs: 100,
				store: new MockStore(),
			}),
		)

		app.post('/upload', (req, res) => {
			if (req.body.test) {
				res.send('Success!')
			} else {
				res.status(400).send('Missing `test` key in body.')
			}
		})

		await request(app)
			.post('/upload')
			.send({ test: true })
			.expect(200)
			.expect(/Success!/)
	})
})
