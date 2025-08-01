⚠️ DEVELOPMENT WARNING: This package is currently under active refactor and restructuring. NOT currently production-ready. 
Core features and APIs may change without notice.

## 🔧  Why Axios-Rate-Control Replaces axios-rate-limit

This module emerged from a real-world ingestion pipeline.
Below are metrics achieved using a previous unpublished version this package. 

**Example Stage 1 Metrics (from live ingestion) using burst pattern and dynamic RPS:**
- 'Pipeline running': '1463s',
- 'Requests': 2.33M
- 'Items processed': 45.19M
- 'Avg RPS Distributed': 1591.53 (Req/Time - full duration - 6 fetcher classes/API keys )
- 'Categories completed': 235/235



## ⚙️ Axios-Rate-Control API Surface
A modular control layer for deterministic, burst-aware traffic shaping.  
Provides runtime orchestration, visibility, and per-instance configuration.

### 🔧 Available Methods 

```js
http.axiosControl() // Attach ARC to axios instance with config settings
http.setOptions() // Runtime config settings dynamic switch / injection
http.getMaxRPS() // Concurrent batch size / RPS alignment 
http.setMaxRPS() // Runtime RPS modification / modulation
http.setBatch() // Set unset sequential / concurrent - with config
http.setBurst() // Runtime timer pattern modulation config
http.getQueue() // Runtime gets reference to current queue array
http.queueDump() // Runtime returns full enqueue array dump. Clears and cancels requests 
http.getStats() // Runtime returns stats trueRPS, maxRPS, ARC instance id
```
## 🧮 Pattern Calculation & Execution Guide

This section explains how to **calculate**, **predict**, and **simulate** the internal request patterning logic based on ARC's configuration parameters. 
So you may design precise traffic shapes that match your ingestion or throttle strategy.

### 📘 Pattern Design Workflow

- Start with `numerator`, `divisor`, and `frequency` to shape your sustained RPS curve.
- Layer to inject rhythm breaks at controlled request slot intervals.
- Set `reset` to time dynamic burst counters and simulate session phases.
- Combine with `isBatch = true` for concurrent peek / off peek burst pattern window.

---

### 🎯 Dynamic RPS Modulation: Formula Breakdown

|  Parameter  |             Function               |
|-------------|------------------------------------|
| `numerator` |           Base RPS value           |
| `frequency` |  Switch `counter`/`divisor` ratio  |
|  `divisor`  |  Fixed alternate  ternary divisor  |
|   `reset`   |  Sets decrement steps until reset  |

##

### 📈 RPS Progression Example
**Config:** numerator: 160, frequency: 2, divisor: 3, reset: 30

**Pattern:** `53 → 80 → 53 → 40 → 53 → 26 → 53 → 20 → 53 → 16 → 53 → 13 → 53 → 11 → 53 → 10 → 53 → 9...`

| Tick | `% frequency === 0`  | Divisor | Expression       | RPS  |
|------|----------------------|---------|------------------|------|
| 1    | false                | 3       | 160 / 3          | 53   |
| 2    | true                 | 2       | 160 / 2          | 80   |
| 3    | false                | 3       | 160 / 3          | 53   |
| 4    | true                 | 4       | 160 / 4          | 40   |
| 5    | false                | 3       | 160 / 3          | 53   |
| 6    | true                 | 6       | 160 / 6          | 26   |
| 7    | false                | 3       | 160 / 3          | 53   |
| 8    | true                 | 8       | 160 / 8          | 20   |
| 9    | false                | 3       | 160 / 3          | 53   |
| 10   | true                 | 10      | 160 / 10         | 16   |
| ...  | ...                  | ...     | ...              | ...  |
| 30   | true                 | 30      | 160 / 30         | 5    |

→ Counter resets at 30, pattern repeats

##
```js
// ARC's Internal with (setDynamic: true)
const rps = Math.floor(numerator / (++counter % frequency === 0 ? counter : divisor)) 
reset === counter ? (counter = 0) : null
```
---

### 🧨 Burst Pattern Execution: Delay Modeling
|    Pattern Type    |     Execution Point    |          Effective Delay           |
|--------------------|------------------------|------------------------------------|
|    Micro Burst     |     Every 3rd slot     |    ~600ms + random(0–400ms)       |
|    Macro Burst     |     Every 30th slot    |     6000ms fixed (no jitter)       |

🔹 When pattern delays coincide the highest delay wins. Both reset.

##

#### ⏱️ Jitter Calculation
**Micro-burst with Jitter**
- Config: `{ delay: 1000, jitter: 40, slots: 3 }`
- Base delay: 600ms (60% of 1000) + Jitter: 0-400ms (40% of 1000)
- Final range: 600-1000ms
- Every 3rd batch request
```js
// Equivalent code:
if (count % 3 === 0) {
  await new Promise(resolve => setTimeout(resolve, 600 + Math.floor(Math.random() * 400)))
  count = 0;
}
```
**Macro-burst**
- Config: `{ delay: 6000, jitter: 0, slots: 30 }`
- Base delay: 6000ms (100%) + Jitter: (0%)
- Triggers: Every 30th batch request
```js
// Equivalent code:
if (count % 30 === 0) {
  await new Promise(resolve => setTimeout(resolve, 6000))
  count = 0;
}
```
**Combined Dynamic RPS + Dual Burst Pattern Execution**

Config: `numerator: 160, frequency: 2, divisor: 3` + Burst patterns every 3rd/30th tick

| Tick | RPS | Window Duration | Burst Type | Notes |
|------|-----|----------------|------------|-------|
| 1    | 53  | 1.00s          | None       | Base rate (160/3) |
| 2    | 80  | 1.00s          | None       | Frequency boost |
| 3    | 53  | 1.00s + 0.6-1.0s | Micro     | 3-slot burst |
| 4    | 40  | 1.00s          | None       | Counter increment |
| 5    | 53  | 1.00s          | None       | Divisor pattern |
| 6    | 26  | 1.00s + 0.6-1.0s | Micro     | 3-slot burst |
| 7    | 53  | 1.00s          | None       | Post-burst resume |
| 8    | 20  | 1.00s          | None       | Lower RPS phase |
| 9    | 53  | 1.00s + 0.6-1.0s | Micro     | 3-slot burst |
| 10   | 16  | 1.00s          | None       | Minimum RPS |
| 12   | 80  | 1.00s + 0.6-1.0s | Micro     | 3-slot burst |
| ...  | ... | ...            | ...        | ... |
| 30   | 16  | 1.00s + 6.0s   | **Macro**  | **30-slot cooldown** |
| 31   | 53  | 1.00s          | None       | Post-cooldown |

- **Micro bursts**: Every 3rd tick adds 0.6-1.0s jittered delay  
- **Macro cooldown**: Every 30th tick adds 6.0s fixed delay
- **Priority**: Macro overrides micro when both trigger simultaneously

---




## 📘 Usage
```js
// Attaching ARC 
http.axiosControl(
  axios.create(), {
    isBatch: true,
    setDynamic: true,
    numerator: 160,
    frequency: 2,
    divisor: 3,
    reset: 30,
    isBurst: true,
    patterns: [
      { delay: 2000, jitter: 40, slots: 10 },
      { delay: 6000, slots: 30 }
    ]
})

// Batch mode concurrent requests
// ❗ Batch length must respect live tick cap via .getMaxRPS()
 const batchSize = http.getMaxRPS()
 const promises = []
  for (let i = 0; i < batchSize; i++) {
    promises.push(http.get(`/api/data?page=${i + 1}`))
  }
  Promise.all(promises)

  http.setMaxRPS(30)

  http.setMaxRPS({ numerator: 160, divisor: 3, frequency: 2, reset: 30 })

  http.setBatch(true)
  http.setBatch(false)  


---
```
```js
.setBurst({ 
  isBurst: true,
  patterns: [
    { delay: 2000, jitter: 40, slots: 6 }, 
    { delay: 6000, jitter: 0, slots: 30 }
  ]
})
```
🔄 **More features, patterns, and control modes coming soon.**  
ARC is under active re-construction expect frequent updates and architecture refinements.


