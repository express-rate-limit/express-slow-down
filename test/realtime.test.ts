import { describe, it } from '@jest/globals'
import express from 'express'
import request from 'supertest'
import bodyParser from 'body-parser'
import slowDown from '../source/express-slow-down'
import { MockStore } from './helpers/mock-store'

describe('realtime tests', () => {
	it('should handle a req being processed before express-slow-down (realtime) (#31 & #32)', (done) => {
		const app = express()

		// Note: in real-world usabe, bodyParser come *after* express-slow-down
		app.use(bodyParser.json({ limit: '50mb' }))

		app.use(
			slowDown({
				delayAfter: 0,
				delayMs: 100,
				store: new MockStore(),
			}),
		)
		app.post('/upload', (request_, res) => {
			if (request_.body.test) {
				res.send('success!')
			} else {
				res.status(400).send('missing test key in body')
			}
		})

		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		request(app)
			.post('/upload')
			.send({ test: true })
			.expect(200)
			.expect(/success!/)
			.end(done)
	})
})
