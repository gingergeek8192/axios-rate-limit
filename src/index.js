const axiosRateLimit = {
  instance_counter: 0,

  rateLimit(inst, options) {
    const limiter = {
      queue: [],
      timeSlotRequests: 0,
      timeoutId: null,
      cancelTokenAware: false,
      trueRPS: 0,
      instance_counter: 0,
      interceptors: { request: null, response: null },

      rpsCallback: () => {},

      setRateLimitOptions(opts) {
        if (opts.maxRPS) {
          limiter.setMaxRPS(opts.maxRPS)
        } else {
          limiter.perMilliseconds = opts.perMilliseconds
          limiter.maxRequests = opts.maxRequests
        }
      },

      setMaxRPS(rps) {
        limiter.setRateLimitOptions({ maxRequests: rps, perMilliseconds: 1000 })
      },

      getQueue() {
        return limiter.queue
      },

      getMaxRPS() {
        return limiter.maxRequests / (limiter.perMilliseconds / 1000)
      },

      rpsLogger(rps) {
        limiter.trueRPS = rps
      },

      setCancelTokenAware() {
        limiter.cancelTokenAware = true
      },

      shiftInitial() {
        setTimeout(() => limiter.dequeue(), 0)
      },

      dequeue() {
        if (!limiter.queue.length) return

        if (limiter.timeSlotRequests === limiter.maxRequests) {
          if (limiter.timeoutId && typeof limiter.timeoutId.ref === 'function') {
            limiter.timeoutId.ref()
          }
          return
        }

        const { resolve, request } = limiter.queue.shift()
        const ok = resolve(request) !== false

        if (limiter.timeSlotRequests === 0) {
          limiter.timeoutId = setTimeout(() => {
            limiter.rpsLogger(limiter.timeSlotRequests)
            limiter.rpsCallback(
              limiter.trueRPS,
              limiter.getMaxRPS(),
              limiter.instance_counter
            )
            limiter.timeSlotRequests = 0
            limiter.dequeue()
          }, limiter.perMilliseconds)

          if (typeof limiter.timeoutId.unref === 'function' && limiter.queue.length === 0) {
            limiter.timeoutId.unref()
          }
        }

        if (ok) limiter.timeSlotRequests += 1
      },

      
      throwIfCancellationRequested(request) {
        if (request.cancelToken) {
          request.cancelToken.throwIfRequested()
        }
      },

      handleResponse(response) {
        limiter.dequeue()
        return response
      },

      handleRequest(request) {
        return limiter.cancelTokenAware
          ? new Promise((resolve, reject) => {
              limiter.queue.push({
                resolve: () => {
                  try {
                    limiter.throwIfCancellationRequested(request)
                  } catch (err) {
                    reject(err)
                    return false
                  }
                  resolve(request)
                  return true
                },
                request
              })
              limiter.shiftInitial()
            })
          : new Promise((resolve) => {
              limiter.queue.push({ resolve, request })
              limiter.shiftInitial()
            })
      },

      enable(inst) {
        const handleError = (error) => Promise.reject(error)
        limiter.interceptors.request = inst.interceptors.request.use(
          limiter.handleRequest,
          handleError
        )
        limiter.interceptors.response = inst.interceptors.response.use(
          limiter.handleResponse,
          handleError
        )
        axiosRateLimit.instance_counter += 1
        limiter.instance_counter = axiosRateLimit.instance_counter

        inst.getQueue = limiter.getQueue
        inst.getMaxRPS = limiter.getMaxRPS
        inst.setMaxRPS = limiter.setMaxRPS
        inst.getTrueRPS = (fn) => (limiter.rpsCallback = fn)
        inst.setRateLimitOptions = limiter.setRateLimitOptions
        inst.setCancelTokenAware = limiter.setCancelTokenAware
      }
    }

    limiter.setRateLimitOptions(options)
    limiter.enable(inst)
    return inst
  }
}

module.exports = axiosRateLimit.rateLimit
