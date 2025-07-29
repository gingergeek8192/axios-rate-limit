import { AxiosInstance } from 'axios';

export type RateControlRequestHandler = {
  resolve: () => boolean
}

export interface RateControlOptions {
  maxRPS?: number
  max_requests_per_window?: number
  perMilliseconds?: number
  singleton?: boolean
  isBatch?: boolean
}

export interface RateControlStats {
  isBurst: boolean
  isBatch: boolean
  trueRPS: number
  maxRPS: number
  instance_id: number | string
}

export interface RateControlRequestHandler {
  resolve: (req?: any) => boolean | void
  request?: any
}

export interface RateControlledAxiosInstance extends AxiosInstance {
  getQueue: () => RateControlRequestHandler[]
  getMaxRPS: () => number
  setMaxRPS: (rps: number) => void
  getTrueRPS: (fn: (trueRPS: number, maxRPS: number) => void) => void
  setRateControlOptions: (options: RateControlOptions) => void
  enableBatchMode: (state: boolean) => void
}



 /**
  * Apply rate limit to axios instance.
  *
  * @example
  *   import axios from 'axios';
  *   import rateLimit from 'axios-rate-limit';
  *
  *   // sets max 2 requests per 1 second, other will be delayed
  *   // note maxRPS is a shorthand for perMilliseconds: 1000, and it takes precedence
  *   // if specified both with maxRequests and perMilliseconds
  *   const http = rateLimit(axios.create(), { maxRequests: 2, perMilliseconds: 1000, maxRPS: 2 })
 *    http.getMaxRPS() // 2
  *   http.get('https://example.com/api/v1/users.json?page=1') // will perform immediately
  *   http.get('https://example.com/api/v1/users.json?page=2') // will perform immediately
  *   http.get('https://example.com/api/v1/users.json?page=3') // will perform after 1 second from the first one
  *   http.setMaxRPS(3)
  *   http.getMaxRPS() // 3
  *   http.setRateControlOptions({ maxRequests: 6, perMilliseconds: 150 }) // same options as constructor
  *
  * @param {Object} axiosInstance axios instance
  * @param {Object} options options for rate limit, available for live update
  * @param {Number} options.maxRequests max requests to perform concurrently in given amount of time.
  * @param {Number} options.perMilliseconds amount of time to limit concurrent requests.
  * @returns {Object} axios instance with interceptors added
  */
export default function rateLimit(
    axiosInstance: AxiosInstance,
    options: rateLimitOptions
): RateControledAxiosInstance;
