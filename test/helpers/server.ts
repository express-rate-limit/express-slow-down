// /test/helpers/server.ts
// Create an Express server for testing

import createApp, {
	type Application,
	type Request,
	type Response,
	type RequestHandler,
} from 'express'

/**
 * Create an Express server with the given middleware.
 */
export const createServer = (
	middleware: RequestHandler | RequestHandler[],
): Application => {
	// Create an Express server, and register the middleware.
	const app = createApp()
	app.use(middleware)

	// Register test routes.
	app.all('/', (_request: Request, response: Response) =>
		response.send('Hi there!'),
	)
	app.get('/ip', (request: Request, response: Response) => {
		response.setHeader('x-your-ip', request.ip)
		response.sendStatus(204)
	})
	app.all('/sleepy', middleware, (_request: Request, response: Response) => {
		const timerId = setTimeout(() => response.send('Hallo there!'), 100)
		response.on('close', () => clearTimeout(timerId))
	})
	app.get('/error', (_request: Request, response: Response) =>
		response.sendStatus(400),
	)
	app.post('/crash', (_request: Request, response: Response) => {
		response.emit('error', new Error('Oops!'))
		response.on('error', () => response.end())
	})

	// Return the application instance.
	return app
}
