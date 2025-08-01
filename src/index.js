const axiosRateControl = {

  instance_id: 0,
  unified: false,
  singleton: false,

  axiosControl(inst, options) {
    if (options.unified && axiosRateControl.singleton) {
      axiosRateControl.singleton.attach_ARC(inst)
      return inst
    }

    const defaults = {
      instance_id: 0,
      queue: [],
      cache: [],
      burst: [],
      max_requests: 10,
      requests_fired_this_window: 0,
      per_milliseconds: 1000,
      counter: 0,
      true_RPS: 0,
      isDynamic: false,
      request_window: null,
      isBasic: false,
      isBatch: false,
      isBurst: false,
      interceptors: { request: null, response: null }
    }

    const dynamicDefaults = {
      numerator: null,
      frequency: null,
      divisor: null,
      reset: null,
    }

    const exposed = {
      getMaxRPS() {
        return ARC.max_requests / (ARC.per_milliseconds / 1000)
      },

      setMaxRPS(RPS) {
        if (ARC.isBasic && typeof RPS === 'object' && (RPS.frequency || RPS.divisor || RPS.numerator)) throw new Error('axios-rate-control: Modulation not permitted in basic limiter mode')
        else if (typeof RPS === 'number') ARC.setRPS(RPS)
        else if (RPS.numerator && RPS.frequency && RPS.divisor && RPS.reset) ARC.dynamicRPS(RPS)
      },

      setBatch(state, config = false) {
        const dump = config.queueDump ? ARC.queueDump() : null
        ARC.isBatch = state
        if (config.isDynamic) ARC.setIsDynamic(config)
        else if (!config.isDynamic) ARC.setMaxRPS(config)
        return dump
      },

      getQueue() {
        return ARC.isBatch ? ARC.cache : ARC.queue
      },

      queueDump() {
        const active = ARC.isBatch ? ARC.cache : ARC.queue
        for (const item of active) {
          if (typeof item.resolve === 'function') {
            try {
              item.resolve(false)
            } catch (_) {}
          }
        }
        return active.splice(0, active.length)
      },

      getStats() {
        return {
          trueRPS: ARC.true_RPS,
          maxRPS: ARC.getMaxRPS(),
          instance_id: !axiosRateControl.singleton ? ARC.instance_id : "singleton",
        }
      },

      setOptions(opts) {
        ARC.setRateControlOptions(opts)
      }
    }

    const ARC = {
      ...defaults,
      ...exposed,
      ...dynamicDefaults,

      rpsCallback: () => { },
      rpsLogger(rps) {
        ARC.true_RPS = rps
      },

      checkMissing(obj, keys) {
        return keys.filter(k => !(k in obj))
      },

      setIsDynamic(dynamic) {
        if (dynamic.setDynamic && !ARC.isDynamic) ARC.isDynamic = dynamic.setDynamic
        const keys = ['numerator', 'frequency', 'divisor', 'reset']
        const missing = ARC.checkMissing(dynamic, keys)
        if (dynamic.setDynamic && missing.length) console.warn(`axios-rate-control: Dynamic mode set without: ${missing.join(', ')}. Use runtime setMaxRPS(frequency: number, divisor: number, numerator: number, reset: number)`)
        ARC.numerator = dynamic.numerator ?? 100
        ARC.frequency = dynamic.frequency ?? 2
        ARC.divisor = dynamic.divisor ?? 3
        ARC.reset = dynamic.reset ?? 10
        if (!dynamic.setDynamic && keys.every(key => dynamic[key] === dynamicDefaults[key])) console.warn(`axios-rate-control: Runtime dynamicRPS called with default values - ensure setMaxRPS(frequency: number, divisor: number, numerator: number, reset: number)`)
      },


      setSingleton() {
        axiosRateControl.unified = true;
        axiosRateControl.singleton = ARC;
      },

      isSetMax(maxRPS) {
        ARC.setMaxRPS(maxRPS)
        ARC.isBasic = true
      },

      setRateControlOptions(opts) {
        opts.isBatch ? ARC.setBatch(true) : ARC.setBatch(false)
        if (opts.maxRPS && !opts.setDynamic) ARC.isSetMax(opts.maxRPS)
        else if (opts.maxRPS && opts.setDynamic) throw new Error('axios-rate-control: Dynamic mode cannot be enabled with maxRPS: number.')

        if (opts.unified && !opts.setDynamic) return ARC.setSingleton()
        else if (opts.unified && opts.setDynamic) throw new Error('axios-rate-control: Dynamic mode cannot be enabled with singleton: true.')

        if (opts.setDynamic) ARC.setIsDynamic(opts)
        if (opts.isBurst && Array.isArray(opts.patterns)) ARC.setBurst({ isBurst: true, patterns: opts.patterns })
        else if (opts.isBurst && !opts.patterns) ARC.setIsBurst()
      },


      setIsBurst() {
        ARC.isBurst = true
        console.warn(`axios-rate-control: Missing burst params. setBurst() must be used for runtime burst patterns`)
      },

      setBurst(config) {
        ARC.isBurst = config.isBurst
        if (ARC.isBurst) {
          if (!Array.isArray(config.patterns) || !config.patterns.length) throw new Error(`axios-rate-control: Burst patterns must be an array patterns: [{slots: number, delay: number}]. See README for examples.`)
          for (const pattern of config.patterns) {
            const { slots, jitter, delay } = pattern
            if (!slots || !delay) throw new Error(`axios-rate-control: Missing burst params ${slots ? `` : `slots: number `}${delay ? `` : `delay: number`}`)
            ARC.burst.push({
              slots: slots,
              jitter: !isNaN(jitter) ? ((jitter / 100) * delay) : 0,
              delay: !isNaN(jitter) ? (delay - jitter) : delay,
              count: 0
            })
          }
        }
      },


      dynamicRPS(dynamic) {
        if (!ARC.isDynamic) throw new Error('axios-rate-control: dynamicRPS requires isDynamic: true.')
        ARC.setIsDynamic(dynamic)
      },

      setRPS(rps) {
        ARC.max_requests = rps
      },


      burst_delay(window) {
        if (!ARC.isBurst) return window()
        const pause = async (pattern) => {
          await new Promise(resolve => setTimeout(resolve, pattern.delay + Math.floor(Math.random() * pattern.jitter)))
          pattern.count = 0
          window()
        }

        const matched = []
        for (const pattern of ARC.burst) {
          ++pattern.count
          if (pattern.count % pattern.slots === 0) {
            matched.push(pattern)
          }
        }

        if (matched.length) {
          const selected = matched.reduce((a, b) => (a.delay > b.delay ? a : b))
          matched.forEach(p => p.count = 0)
          return pause(selected)
        }

        return window()
      },

      setWindow() {
        if (ARC.request_window) clearTimeout(ARC.request_window)
        ARC.request_window = setTimeout(() => {
          ARC.rpsLogger(ARC.requests_fired_this_window)
          ARC.requests_fired_this_window = 0
          if (ARC.isDynamic) {
            ARC.setRPS(Math.floor(ARC.numerator / (++ARC.counter % ARC.frequency === 0 ? ARC.counter : ARC.divisor)))
            if (ARC.counter === ARC.reset) ARC.counter = 0
          }
          !ARC.isBatch && ARC.dequeue_sequential()
        }, ARC.per_milliseconds)
      },

      shiftInitial() {
        setTimeout(() => ARC.dequeue_sequential(), 0)
      },

      handle_batch_request(request) {
        const promise = new Promise(resolve => ARC.cache.push({ resolve, request }))
        const batch_resolve = () => {
          ARC.cache.slice(0, ARC.getMaxRPS())
            .map(({ resolve, request }) => {
              if (resolve(request) !== false) ARC.requests_fired_this_window += 1
            })
          ARC.cache.splice(0, ARC.requests_fired_this_window)
        }
        if (ARC.cache.length >= ARC.max_requests && ARC.requests_fired_this_window === 0) {
          batch_resolve()
          ARC.burst_delay(() => ARC.setWindow())
        }
        return promise
      },

      dequeue_sequential() {
        if (!ARC.queue.length) return
        if (ARC.requests_fired_this_window === ARC.max_requests) return ARC.request_window && typeof ARC.request_window.ref === 'function' && ARC.request_window.ref()
        const { resolve, request } = ARC.queue.shift()
        const resolved = resolve(request) !== false
        if (ARC.requests_fired_this_window === 0) ARC.burst_delay(() => ARC.setWindow())
        if (ARC.requests_fired_this_window === 0 && typeof ARC.request_window.unref === 'function' && ARC.queue.length === 0) ARC.request_window.unref()
        if (!resolved) return ARC.dequeue_sequential()
        ARC.requests_fired_this_window += 1
        if (ARC.requests_fired_this_window < ARC.max_requests) return ARC.dequeue_sequential()
      },

      handle_sequential_response(response) {
        ARC.dequeue_sequential()
        return response
      },

      handle_sequential_request(request) {
        return new Promise((resolve) => {
          ARC.queue.push({ resolve, request })
          ARC.shiftInitial()
        })
      },

      intercept(inst) {
        ARC.interceptors.request = inst.interceptors.request.use(
          (req) => ARC.isBatch ? ARC.handle_batch_request(req) : ARC.handle_sequential_request(req),
          (err) => Promise.reject(err)
        )
        ARC.interceptors.response = inst.interceptors.response.use(
          (res) => ARC.isBatch ? res : ARC.handle_sequential_response(res),
          (err) => Promise.reject(err)
        )
      },

      attach_ARC(inst) {
        ARC.intercept(inst)
        axiosRateControl.instance_id += 1;
        ARC.instance_id = axiosRateControl.instance_id;
        inst.getMaxRPS = ARC.getMaxRPS;
        inst.setMaxRPS = ARC.setMaxRPS;
        inst.setBatch = ARC.setBatch;
        inst.getQueue = ARC.getQueue;
        inst.setBurst = ARC.setBurst;
        inst.getStats = ARC.getStats;
        inst.queueDump = ARC.queueDump;
        inst.setOptions = ARC.setRateControlOptions;
      }
    }

    ARC.setRateControlOptions(options)
    ARC.attach_ARC(inst)
    return inst
  }
}

module.exports = axiosRateControl.axiosControl