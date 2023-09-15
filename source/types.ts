import type { Response } from 'express';
import type { AugmentedRequest as ERLAugmentedRequest, RateLimitInfo, Options as ERLOptions, ValueDeterminingMiddleware } from 'express-rate-limit'

export type SlowDownInfo = RateLimitInfo & {
    delay: number
}
export type AugmentedRequest = ERLAugmentedRequest & {
    [key: string]: SlowDownInfo
}

export type DelayFn = (used: number, request: AugmentedRequest, response: Response) => number | Promise<number>

export type Options = ERLOptions & {
    // express-slow-down specific options
    delayAfter: number | ValueDeterminingMiddleware<number>,
    delayMs: number | DelayFn,
    maxDelayMs: number | ValueDeterminingMiddleware<number>,

    // headers are not supported
    headers?: false,
    lefacyHeaders?: false,
    standardHeaders?: false,

    // limit / max is set from delayAfter
    limit: never,
    max: never,

    // handler is set by this library
    handler: never,
}