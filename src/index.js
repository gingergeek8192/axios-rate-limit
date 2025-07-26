const axiosRateLimit = {
  queue: [],
  timeSlotRequests: 0,
  maxRequests: 1,
  perMilliseconds: 1000,
  timeoutId: null,

  interceptors: { 
  request: null, 
  response: null 
  },

  throwIfCancellationRequested(config) {
    if (config.cancelToken) {
      config.cancelToken.throwIfRequested()
    }
  },

  shiftInitial() {
    setTimeout(() => this.queued_shift(), 0)
  },

  enqueue_(requestHandler) {
    this.queue.push(requestHandler)
    this.shiftInitial()
  },

  handleResponse(response) {
    this.queued_shift()
    return response
  },

  handleRequest(request) {
    return new Promise((resolve, reject) => {
      this.enqueue_({
        resolve: () => {
          try {
            this.throwIfCancellationRequested(request)
          } catch (error) {
            reject(error)
            return false
          }
          resolve(request)
          return true
        }
      })
    })
  },

  enable(inst) {
    const handleError = (error) => Promise.reject(error)

    this.interceptors.request = inst.interceptors.request.use(
      this.handleRequest.bind(this),
      handleError
    )

    this.interceptors.response = inst.interceptors.response.use(
      this.handleResponse.bind(this),
      handleError
    )
  },

  setRateLimitOptions(options) {
    if (options.maxRPS) {
      this.setMaxRPS(options.maxRPS)
    } else {
      this.perMilliseconds = options.perMilliseconds
      this.maxRequests = options.maxRequests
    }
  },

  setMaxRPS(rps) {
    this.setRateLimitOptions({ maxRequests: rps, perMilliseconds: 1000 })
  },

  getQueue() {
    return this.queue
  },

  getMaxRPS() {
    return this.maxRequests / (this.perMilliseconds / 1000)
  },

  queued_shift() {
    if (!this.queue.length) return

    if (this.timeSlotRequests === this.maxRequests) {
      if (this.timeoutId && typeof this.timeoutId.ref === 'function') {
        this.timeoutId.ref()
      }
      return
    }

    const queued = this.queue.shift()
    const resolved = queued.resolve()

    if (this.timeSlotRequests === 0) {
      this.timeoutId = setTimeout(() => {
        this.timeSlotRequests = 0
        this.queued_shift()
      }, this.perMilliseconds)

      if (typeof this.timeoutId.unref === 'function' && this.queue.length === 0) {
        this.timeoutId.unref()
      }
    }

    if (!resolved) {
      this.queued_shift()
      return
    }

    this.timeSlotRequests += 1
  },

  rateLimit(inst, options) {
    this.setRateLimitOptions(options)
    this.enable(inst)

    inst.getQueue = this.getQueue.bind(this)
    inst.getMaxRPS = this.getMaxRPS.bind(this)
    inst.setMaxRPS = this.setMaxRPS.bind(this)
    inst.setRateLimitOptions = this.setRateLimitOptions.bind(this)
    return inst
  }
}

module.exports = axiosRateLimit.rateLimit.bind(axiosRateLimit)
