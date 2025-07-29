# axios-rate-limit (Custom Fork)

> ⚠️ **DEVELOPMENT WARNING**: This fork is currently under active development and is **NOT production-ready**. Core features are incomplete and APIs may change without notice. Use the [original axios-rate-limit](https://github.com/aishek/axios-rate-limit) for production applications.

🛠️ Custom fork of [`aishek/axios-rate-limit`](https://github.com/aishek/axios-rate-limit)


This is not just a basic rate limiter — while built on axios-rate-limit foundations, this fork adds powerful traffic shaping capabilities designed for advanced use cases such as:
Dynamic burst grouping and batch request management
Jitter and randomized pause injection to evade sliding window/token bucket throttlers
Runtime analytics for real RPS tracking beyond configured limits
Cancel token awareness for safe request queue skipping
Highly configurable delay and throttle patterns for adversarial and high-throughput environments
This enables fine-tuned control of request flow beyond simple fixed-rate limiting.

- Burst grouping (upcoming)
- Jitter injection
- Dynamic delay patterns for evading token bucket and sliding window RPS limiters

---

## 🚀 Why This Fork?

This custom version restructures the original library to better support:

- Centralized control over queue state and internal timers ✅
- Runtime analytics (`trueRPS` vs configured `maxRPS`) ✅
- **Dynamic injection of delay, pause, jitter, and burst behavior** _(in active development)_
- **Optional cancel token awareness for safely skipping queued requests** _(experimental)_

This architecture supports future features like burst grouping, jitter profiles,
and adaptive throttling—tailored for adversarial conditions and advanced traffic modulation.

## 📦 Installation

```bash
📘 Usage

import axios from 'axios'
import rateLimit from 'axios-rate-limit'

// Sets max 2 requests per second
const http = rateLimit(axios.create(), {
  maxRequests: 2,
  perMilliseconds: 1000,
})

const http = rateLimit(axios.create(), {
  maxRPS: 2
})

const http = rateLimit(axios.create(), {
  isBatch: true
})

const http = rateLimit(axios.create(), {
  singleton: true
  isBatch: false
})

// Advanced: Dynamic RPS Adjustment for Evasion
let count = 0, multiplier = 1

// Batch processing with unpredictable rate changes
const batchSize = http.getMaxRPS()
for (let i = 0; i < batchSize; i++) {
  promises.push(http.get(`/api/data?page=${i + 1}`))
}

// Dynamic rate adjustment after each batch
http.setMaxRPS(Math.floor(160 / (++count % 2 === 0 ? multiplier += 1 : 3)))

await Promise.all(promises)


Each call to `rateLimit()` produces a scoped limiter,
with isolated state across instances.

// Requests 1 & 2 execute immediately
instance.get('https://example.com/api/v1/users?page=1')
instance.get('https://example.com/api/v1/users?page=2')

// 3rd request delayed by 1 second
instance.get('https://example.com/api/v1/users?page=3')


      // setPause({ maxMilis: 2000, jitterPercent: 40, timeSlots: 10 })
      // → Base delay: 1200ms (60% of 2000)
      // → Jitter range: +0–800ms (40% of 2000)
      // → Final delay range: 1200–2000ms, applied every 10 time slots

// Access queue state
instance.getQueue()

// Hot-reload rate options at runtime
instance.setMaxRPS(3)
instance.setRateLimitOptions({ maxRequests: 6, perMilliseconds: 150 })

// Enable cancelToken-aware behavior
instance.setCancelTokenAware()

// Tracking Real-Time RPS
// Monitor live dispatched RPS with a callback, logs per p/s limit window

    instance.getTrueRPS((trueRPS, maxRPS, instance_counter) => {
        console.log('trueRPS:', trueRPS) // requests dequeued
        console.log('maxRPS:', maxRPS) // maximum requests
        console.log('instance_counter:', instance_counter) // rate limiter instance attached
    })

🔄 Alternatives
axios-rate-limit (original)
axios-concurrency
p-queue
Native Axios v1+ rate-limiting
```
