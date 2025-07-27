
const axiosRateLimit = {

  counter: 0, 

  rateLimit(inst, options) {
    const limiter = {
      queue: [],
      timeSlotRequests: 0,
      timeoutId: null,
      cancelTokenAware: false,
      trueRPS: 0,
      counter: 0,
      rpsCallback: () => {},

      setRateLimitOptions(opts) {
        if (opts.maxRPS) {
          opts.maxRequests = opts.maxRPS
          opts.perMilliseconds = 1000
        }
        Object.assign(options, opts)
      },

      getQueue() {
        return limiter.queue
      },

      getMaxRPS() {
        return options.maxRequests / (options.perMilliseconds / 1000)
      },

      setCancelTokenAware() {
        limiter.cancelTokenAware = true
      },

      shiftInitial() {
        setTimeout(() => limiter.dequeue(), 0)
      },

      dequeue() {
        if (!limiter.queue.length) return
        if (limiter.timeSlotRequests === options.maxRequests) {
          limiter.timeoutId?.ref?.()
          return
        }

        const { resolve, request } = limiter.queue.shift()
        const ok = resolve(request) !== false

        if (limiter.timeSlotRequests === 0) {
          limiter.timeoutId = setTimeout(() => {
            limiter.trueRPS = limiter.timeSlotRequests
            limiter.rpsCallback(
              limiter.trueRPS,
              limiter.getMaxRPS(),
              limiter.counter
            )
            limiter.timeSlotRequests = 0
            limiter.dequeue()
          }, options.perMilliseconds)

          if (limiter.timeoutId?.unref && limiter.queue.length === 0) {
            limiter.timeoutId.unref()
          }
        }

        if (ok) limiter.timeSlotRequests += 1
      },

      handleRequest(request) {
        return limiter.cancelTokenAware
          ? new Promise((resolve, reject) => {
              limiter.queue.push({
                resolve: () => {
                  try {
                    if (request.cancelToken) request.cancelToken.throwIfRequested()
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

      handleResponse(response) {
        limiter.dequeue()
        return response
      },

      enable(inst) {
        inst.interceptors.request.use(limiter.handleRequest, Promise.reject)
        inst.interceptors.response.use(limiter.handleResponse, Promise.reject)
        axiosRateLimit.counter += 1
        limiter.counter = axiosRateLimit.counter
        inst.getQueue = limiter.getQueue
        inst.getMaxRPS = limiter.getMaxRPS
        inst.setMaxRPS = (rps) => limiter.setRateLimitOptions({ maxRPS: rps })
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
