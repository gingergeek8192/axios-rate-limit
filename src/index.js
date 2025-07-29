const axiosRateControl = {

  instance_id: 0,
  unified: false,
  singleton: false,

  rateControl(inst, options) {
    if (options.unified && axiosRateControl.singleton) {
      axiosRateControl.singleton.attach_ARC(inst)
      return inst
    }

    const ARC = {
      queue: [],
      cache: [],
      requests_fired_this_window: 0,
      request_window: null,
      true_RPS: 0,
      instance_id: 0,
      isBatch: false,
      isBurst: false,
      isDynamic: false,
      numerator: false, 
      frequency: false, 
      divisor: false,
      interceptors: { request: null, response: null },
      rpsCallback: () => { },

      setRateControlOptions(opts) {
        if (opts.isBatch) ARC.enableBatchMode(opts.isBatch)

        if (opts.isDynamic) {
          ARC.isDynamic = opts.isDynamic
        }

        if (opts.isDynamic && !opts.isBurst) {
          throw new Error('axios-rate-control: dynamicRPS requires burst mode. Set isBurst: true.')
        }

        if (opts.singleton && !ARC.isBatch) {
          axiosRateControl.unified = true
          axiosRateControl.singleton = ARC
        }

       if (opts.maxRPS) {
          ARC.setMaxRPS(opts.maxRPS)
        } else if (opts.numerator && opts.frequency && opts.divisor && opts.isDynamic) {
          ARC.numerator = opts.numerator
          ARC.frequency = opts.frequency
          ARC.divisor = opts.divisor
        } else if (opts.per_milliseconds && opts.max_requests_per_window) {
          ARC.per_milliseconds = opts.per_milliseconds
          ARC.max_requests_per_window = opts.max_requests_per_window
          //Reminder that properties are not set. This may be intentional for on the fly dynamic RPS adjustments . manually through setMaxRPS or using a burst pattern
        } else console.warn('axios-rate-control: RPS opts not set. Use setMaxRPS(numerator, frequency, divisor) burst pattern or setMaxRPS(number) ')
      },

      enableBatchMode(state) {
        if (state && axiosRateControl.unified) {
          throw new Error('axios-rate-control: Batch mode cannot be enabled in singleton mode.')
        }
        ARC.isBatch = state
      },

      // this is for on the fly dynamic RPS or it will setMaxRPS(30) 
      setMaxRPS(numerator, frequency = false,  divisor = false) {
      if ((!ARC.frequency || !ARC.divisor) && (!frequency || !divisor)) ARC.setRPS(numerator) 
      else if ((!ARC.frequency || !ARC.divisor) && (frequency && divisor)) ARC.dynamicRPS(numerator, frequency, divisor)
      },

      dynamicRPS(numerator, frequency, divisor) {
       if (frequency && divisor) {
        if (!opts.isDynamic) {
          throw new Error('axios-rate-control: dynamicRPS requires isDynamic: true.')
        }
        ARC.numerator = numerator
        ARC.frequency = frequency 
        ARC.divisor = divisor 
      }
       ARC.isDynamic ? ARC.setRPS(Math.floor(ARC.numerator / (++ARC.request_window_counter %  ARC.frequency === 0 ? ARC.multiplier += 1 :  ARC.divisor))) : 
       ARC.setRPS(numerator)
      },

      setRPS(rps) {
        ARC.setRateControlOptions({ max_requests_per_window: rps, per_milliseconds: 1000 })
      },

      getQueue() {
        return ARC.queue
      },

      getMaxRPS() {
        return ARC.max_requests_per_window / (ARC.per_milliseconds / 1000)
      },

      rpsLogger(rps) {
        ARC.true_RPS = rps
      },

      setPause(args) {
        ARC.pause_pattern = true
        if (!isNaN(args.jitterPercent)) {
          ARC.jitter = (args.jitterPercent / 100) * args.maxMilis
          ARC.nominal = args.maxMilis - ARC.jitter
        } else {
          ARC.jitter = 0
          ARC.nominal = args.maxMilis
        }
        ARC.slots = args.timeSlots
      },

      async pause() {
        if (ARC.request_window_counter % ARC.slots === 0) {
          await new Promise(resolve => setTimeout(resolve, ARC.nominal + Math.floor(Math.random() * ARC.jitter)))
        }
      },

      setWindow() {
        ARC.request_window = setTimeout(() => {
          ARC.rpsLogger(ARC.requests_fired_this_window)
          ARC.requests_fired_this_window = 0
          !ARC.isBatch && ARC.dequeue_sequential()
          ARC.request_window_counter = 0
          ARC.multiplier = 1
        }, ARC.per_milliseconds)
      },

      shiftInitial() {
        setTimeout(() => ARC.dequeue_sequential(), 0)
      },

      handle_batch_request(request) {
        const promise = new Promise(resolve => ARC.cache.push({ resolve, request }))
        const batch_resolve = () => {
          ARC.cache
            .slice(0, ARC.getMaxRPS())
            .map(({ resolve, request }) => {
              if (resolve(request) !== false) ARC.requests_fired_this_window += 1
            })
          ARC.cache.splice(0, ARC.max_requests_per_window)
        }

        if (ARC.cache.length >= ARC.max_requests_per_window && ARC.requests_fired_this_window === 0) {
          batch_resolve()
          ARC.setWindow()
        }
        return promise
      },

      dequeue_sequential() {
        if (!ARC.queue.length) return
        if (ARC.requests_fired_this_window === ARC.max_requests_per_window) {
          if (ARC.request_window && typeof ARC.request_window.ref === 'function') {
            ARC.request_window.ref()
          }
          return
        }

        const { resolve, request } = ARC.queue.shift()
        const resolved = resolve(request) !== false

        if (ARC.requests_fired_this_window === 0) {
          ARC.setWindow()
          if (typeof ARC.request_window.unref === 'function' && ARC.queue.length === 0) {
            ARC.request_window.unref()
          }
        }

        if (!resolved) {
          ARC.dequeue_sequential()
          return
        }

        ARC.requests_fired_this_window += 1

        if (ARC.requests_fired_this_window < ARC.max_requests_per_window) {
          ARC.dequeue_sequential()
        }
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


      attach_ARC(inst) {
        ARC.interceptors.request = inst.interceptors.request.use(
          (req) => {
            return ARC.isBatch ? ARC.handle_batch_request(req) : ARC.handle_sequential_request(req)
          },
          (err) => Promise.reject(err)
        )

        ARC.interceptors.response = inst.interceptors.response.use(
          (res) => {
            return ARC.isBatch ? res : ARC.handle_sequential_response(res)
          },
          (err) => Promise.reject(err)
        )

        axiosRateControl.instance_id += 1
        ARC.instance_id = axiosRateControl.instance_id
        inst.enableBatchMode = ARC.enableBatchMode
        inst.getQueue = ARC.getQueue
        inst.getMaxRPS = ARC.getMaxRPS
        inst.setMaxRPS = ARC.setMaxRPS

        inst.getRateControlStats = () => ({
          isBurst: ARC.isBurst,
          isBatch: ARC.isBatch,
          trueRPS: ARC.true_RPS,
          maxRPS: ARC.getMaxRPS(),
          instance_id: !axiosRateControl.singleton ? ARC.instance_id : 'singleton'
        })

        inst.setRateControlOptions = ARC.setRateControlOptions
      }
    }


    ARC.setRateControlOptions(options)
    ARC.attach_ARC(inst)
    return inst
  }
}

module.exports = axiosRateControl.rateControl
/*
 // setPause({ maxMilis: 2000, jitterPercent: 40, timeSlots: 10 })
  // → Base delay: 1200ms (60% of 2000)
  // → Jitter range: +0–800ms (40% of 2000)
  // → Final delay range: 1200–2000ms, applied every 10 time slots

  setPause(args) {
    ARC.pause_pattern = true
    if (!isNaN(args.jitterPercent)) {
      ARC.jitter = (args.jitterPercent / 100) * args.maxMilis
      ARC.nominal = args.maxMilis - ARC.jitter
    } else {
      ARC.jitter = 0
      ARC.nominal = args.maxMilis
    }
    ARC.slots = args.timeSlots
  },

  async pause() {
    if (ARC.timeSlot_counter % ARC.slots === 0) {
      await new Promise(resolve => setTimeout(resolve, ARC.nominal + Math.floor(Math.random() * ARC.jitter)))
      ARC.timeSlot_counter = 0
    }
  },

Context
Add default state and make the functions configurable:

const ARC = {
  queue: [],
  cache: [],
  requests_fired_this_window: 0,
  request_window: null,
  true_RPS: 0,
  instance_id: 0,
  isBatch: false,
  interceptors: { request: null, response: null },
  rpsCallback: () => { },
  
  // Dynamic RPS defaults
  count: 0,
  multiplier: 1,
  baseRPS: 160,
  divisor: 3,
  
  // Pause pattern defaults
  pause_pattern: false,
  jitter: 0,
  nominal: 1000,
  slots: 1,
  timeSlot_counter: 0,

  setDynamicRPS(config = {}) {
    ARC.baseRPS = config.baseRPS || 160
    ARC.divisor = config.divisor || 3
    ARC.count = config.startCount || 0
    ARC.multiplier = config.startMultiplier || 1
  },

  dynamicRPS() {
    ARC.setMaxRPS(Math.floor(ARC.baseRPS / (++ARC.count % 2 === 0 ? ARC.multiplier += 1 : ARC.divisor)))
  },

  setPause(args = {}) {
    const maxMilis = args.maxMilis || 1000
    const jitterPercent = args.jitterPercent || 0
    
    ARC.pause_pattern = true
    if (!isNaN(jitterPercent)) {
      ARC.jitter = (jitterPercent / 100) * maxMilis
      ARC.nominal = maxMilis - ARC.jitter
    } else {
      ARC.jitter = 0
      ARC.nominal = maxMilis
    }
    ARC.slots = args.timeSlots || 1
  },


Copy

Insert at cursor
javascript
Usage:

// Use defaults
http.dynamicRPS()
http.setPause()

// Or customize
http.setDynamicRPS({ baseRPS: 200, divisor: 4 })
http.setPause({ maxMilis: 2000, jitterPercent: 40, timeSlots: 10 })

Copy

Insert at cursor
javascript
id I wanted to create a pattern like this one coud I do that by passing an array of configs and using a foreEach if (this.count % 3 === 0) {
await new Promise(resolve => setTimeout(resolve, 1000));
}
if (this.count % 30 === 0) {
await new Promise(resolve => setTimeout(resolve, 6000));
this.count = 0
this.multiplier = 1
}


Context
Absolutely! You can create a configurable pause pattern system:

// Add to ARC defaults
pausePatterns: [],
count: 0,
multiplier: 1,

setPausePatterns(patterns) {
  ARC.pausePatterns = patterns
},

async executePausePatterns() {
  for (const pattern of ARC.pausePatterns) {
    if (ARC.count % pattern.interval === 0) {
      await new Promise(resolve => setTimeout(resolve, pattern.delay))
      
      // Optional reset actions
      if (pattern.resetCount) ARC.count = 0
      if (pattern.resetMultiplier) ARC.multiplier = 1
    }
  }
}

Copy

Insert at cursor
javascript
Usage:

http.setPausePatterns([
  { interval: 3, delay: 1000 },
  { interval: 30, delay: 6000, resetCount: true, resetMultiplier: true }
])

// Then call in your batch processing
await http.executePausePatterns()

Copy

Insert at cursor
javascript
Or even more flexible with callbacks:

setPausePatterns([
  { 
    interval: 3, 
    delay: 1000 
  },
  { 
    interval: 30, 
    delay: 6000,
    onTrigger: () => {
      ARC.count = 0
      ARC.multiplier = 1
    }
  }
])

Copy

Insert at cursor
javascript
This gives you complete control over complex pause patterns while keeping the API clean and reusable.

and now couple that with a jiter implmemntation


Context
Perfect! Here's the combined pause patterns with jitter implementation:

// Add to ARC defaults
pausePatterns: [],
count: 0,
multiplier: 1,

setPausePatterns(patterns) {
  ARC.pausePatterns = patterns.map(pattern => ({
    interval: pattern.interval,
    delay: pattern.delay,
    jitterPercent: pattern.jitterPercent || 0,
    resetCount: pattern.resetCount || false,
    resetMultiplier: pattern.resetMultiplier || false,
    onTrigger: pattern.onTrigger || null
  }))
},

calculateJitteredDelay(baseDelay, jitterPercent) {
  if (!jitterPercent) return baseDelay
  const jitter = (jitterPercent / 100) * baseDelay
  const nominal = baseDelay - jitter
  return nominal + Math.floor(Math.random() * jitter)
},

async executePausePatterns() {
  for (const pattern of ARC.pausePatterns) {
    if (ARC.count % pattern.interval === 0) {
      const jitteredDelay = ARC.calculateJitteredDelay(pattern.delay, pattern.jitterPercent)
      await new Promise(resolve => setTimeout(resolve, jitteredDelay))
      
      if (pattern.resetCount) ARC.count = 0
      if (pattern.resetMultiplier) ARC.multiplier = 1
      if (pattern.onTrigger) pattern.onTrigger()
    }
  }
}


Copy

Insert at cursor
javascript
Usage:

http.setPausePatterns([
  { 
    interval: 3, 
    delay: 1000, 
    jitterPercent: 20  // 800-1000ms range
  },
  { 
    interval: 30, 
    delay: 6000, 
    jitterPercent: 40,  // 3600-6000ms range
    resetCount: true, 
    resetMultiplier: true 
  }
])

// In your batch processing
ARC.count++
await http.executePausePatterns()


// Available in both sequential and batch modes
setPausePatterns(patterns) {
  ARC.pausePatterns = patterns
},

async executePausePatterns() {
  // Works in both modes - called externally by user
  for (const pattern of ARC.pausePatterns) {
    if (ARC.count % pattern.interval === 0) {
      const jitteredDelay = ARC.calculateJitteredDelay(pattern.delay, pattern.jitterPercent)
      await new Promise(resolve => setTimeout(resolve, jitteredDelay))
      // ... reset logic
    }
  }
}

*/