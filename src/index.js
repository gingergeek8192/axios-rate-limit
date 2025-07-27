const axiosRateLimit = {
  queue: [],
  timeSlotRequests: 0,
  maxRequests: 1,
  perMilliseconds: 1000,
  timeoutId: null,
  cancelTokenAware: false,
  trueRPS: 0,
  interceptors: {
    request: null,
    response: null
  },

    rpsCallback: () => {},
    getTrueRPS(fn) {
      this.rpsCallback = fn
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

  rpsLogger(rps) {
    this.trueRPS = rps
  },

  setCancelTokenAware() {
    this.cancelTokenAware = true
  },

  shiftInitial() {
    setTimeout(() => this.dequeue(), 0)
  },

  dequeue() {
    if (!this.queue.length) return

    if (this.timeSlotRequests === this.maxRequests) {
      if (this.timeoutId && typeof this.timeoutId.ref === 'function') {
        this.timeoutId.ref()
      }
      return
    }

    const { resolve, request } = this.queue.shift()
    const ok = resolve(request) !== false

    if (this.timeSlotRequests === 0) {
      this.timeoutId = setTimeout(() => {
        this.rpsLogger(this.timeSlotRequests)
        this.rpsCallback(this.trueRPS, this.getMaxRPS())
        this.timeSlotRequests = 0
        this.dequeue()
      }, this.perMilliseconds)

      if (typeof this.timeoutId.unref === 'function' && this.queue.length === 0) {
        this.timeoutId.unref()
      }
    }

    if (ok) this.timeSlotRequests += 1
  },

  handleResponse(response) {
    this.dequeue()
    return response
  },

  handleRequest(request) {
    return this.cancelTokenAware ? new Promise((resolve, reject) => {
          this.queue.push({
            resolve: () => {
              try {
                if (request.cancelToken) {
                  request.cancelToken.throwIfRequested()
                }
              } catch (err) {
                reject(err)
                return false
              }
              resolve(request)
              return true
            },
            request
          })
          this.shiftInitial()
        })
      : new Promise((resolve) => {
          this.queue.push({ resolve, request })
          this.shiftInitial()
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

  rateLimit(inst, options) {
    this.setRateLimitOptions(options)
    this.enable(inst)
    inst.getQueue = this.getQueue.bind(this)
    inst.getMaxRPS = this.getMaxRPS.bind(this)
    inst.setMaxRPS = this.setMaxRPS.bind(this)
    inst.getTrueRPS = this.getTrueRPS.bind(this)
    inst.setRateLimitOptions = this.setRateLimitOptions.bind(this)
    inst.setCancelTokenAware = this.setCancelTokenAware.bind(this)
    return inst
  }
}

module.exports = axiosRateLimit.rateLimit.bind(axiosRateLimit)