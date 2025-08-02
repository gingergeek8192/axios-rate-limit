
import { AxiosInstance } from 'axios';

export type RateControlRequestHandler = {
  resolve: () => boolean
}

export interface RateControlOptions {
  maxRPS?: number
  max_requests?: number
  per_milliseconds?: number
  singleton?: boolean
  isBatch?: boolean
  isBurst?: boolean
  isDynamic?: boolean
  numerator?: number
  frequency?: number
  divisor?: number
}

export interface RateControlStats {
  isBurst: boolean
  isBatch: boolean
  trueRPS: number
  maxRPS: number
  instance_id: number | string
}

export interface BurstPattern {
  slots: number
  delay: number
  jitter?: number
}

export interface BurstConfig {
  isBurst: boolean
  patterns: BurstPattern[]
}

export interface DynamicRPSConfig {
  numerator: number
  frequency: number
  divisor: number
  reset: number
}

export interface RateControlledAxiosInstance extends AxiosInstance {
  getQueue: () => RateControlRequestHandler[]
  setMaxRPS: (rps: number | DynamicRPSConfig) => void
  setMaxRPS: (rps: number) => void
  getStats: () => RateControlStats
  queueDump: () => any[]
  setBurst: ( config: BurstConfig) => void
  setBatch: (state: boolean) => void
  getMaxRPS: () => number
}


export default function axiosControl(
    axiosInstance: AxiosInstance,
    options: RateControlOptions
): RateControlledAxiosInstance;
