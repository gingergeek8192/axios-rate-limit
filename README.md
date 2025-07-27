# axios-rate-limit (Custom Fork)

🛠️ Custom fork of [`aishek/axios-rate-limit`](https://github.com/aishek/axios-rate-limit)

A rate limiter for Axios that restricts how many requests per interval are sent.  
This fork was heavily refactored to enable **advanced traffic shaping**, including:

- Burst grouping (upcoming)
- Jitter injection
- Dynamic delay patterns for evading token bucket and sliding window RPS limiters

---

## 🚀 Why This Fork?

This custom version restructures the original library to better support:

- Centralized control over queue state and internal timers ✅
- Runtime analytics (`trueRPS` vs configured `maxRPS`) ✅
- **Dynamic injection of delay, pause, jitter, and burst behavior** *(in active development)*
- **Optional cancel token awareness for safely skipping queued requests** *(experimental)*

This architecture supports future features like burst grouping, jitter profiles, 
and adaptive throttling—tailored for adversarial conditions and advanced traffic modulation.


## 📦 Installation

```bash
npm install axios-rate-limit
⚠️ This currently installs the upstream version. 
Clone and link locally until this fork is published under a new name.

---

📘 Usage

import axios from 'axios'
import rateLimit from 'axios-rate-limit'

// Sets max 2 requests per second
const http = rateLimit(axios.create(), {
  maxRequests: 2,
  perMilliseconds: 1000,
  maxRPS: 2
})
Each call to `rateLimit()` produces a scoped limiter,  
with isolated state across instances.


// Requests 1 & 2 execute immediately
instance.get('https://example.com/api/v1/users?page=1')
instance.get('https://example.com/api/v1/users?page=2')

// 3rd request delayed by 1 second
instance.get('https://example.com/api/v1/users?page=3')

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