⚠️ DEVELOPMENT WARNING: This package is currently under active refactor and restructuring. NOT production-ready. 
Core features are incomplete and APIs may change without notice.

## 🔧  Why Axios-Rate-Control Replaces axios-rate-limit

This module emerged from a real-world ingestion pipeline.
Below are metrics achieved by pipeline stage 1 using this package. 

**Example Stage 1 Metrics (from live ingestion) using burst pattern and dynamic RPS:**
- 'Pipeline running': '1463s',
- 'Requests': 2.33M
- 'Items processed': 45.19M
- 'Avg RPS Distributed': 1591.53 (RPS over time. req/t. 6 classes / API keys over full duration)
- 'Categories completed': 235/235



## ⚙️ Axios-Rate-Control API Surface

Modular control layer for deterministic, burst-aware traffic shaping.  
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

This section explains how to **calculate**, **predict**, and **simulate** the internal request patterning logic based on ARC's configuration parameters. So you may design precise traffic shapes that match your ingestion or throttle strategy.

---

### 🎯 Dynamic RPS Modulation: Formula Breakdown

```js
// Internal RPS logic when setDynamic = true
const rps = Math.floor(numerator / (counter % frequency === 0 ? counter : divisor))
```
____________________________________________________
|  Parameter  |             Function               |
|-------------|------------------------------------|
| `numerator` |           Base RPS value           |
| `frequency` |  Switch `counter`/`divisor` ratio  |
|  `divisor`  |  Fixed alternate  ternary divisor  |
|   `reset`   |  Sets decrement steps until reset  |
----------------------------------------------------

### 📈 RPS Progression Example


numerator: 100, frequency: 2, divisor: 3, reset: 10

Tick 1  → 100 / 3  = 33  
Tick 2  → 100 / 2  = 50  
Tick 3  → 100 / 3  = 33  
Tick 4  → 100 / 4  = 25  
Tick 5  → 100 / 3  = 33  
Tick 6  → 100 / 6  = 16  
Tick 7  → 100 / 3  = 33  
Tick 8  → 100 / 8  = 12  
Tick 9  → 100 / 3  = 33  
Tick 10 → 100 / 10 = 10  
→ Counter resets, pattern repeats

Tick	% freq === 0	Divisor Used	RPS (⌊100 / divisor⌋)
1	false	3	33
2	true	2	50
3	false	3	33
4	true	4	25
5	false	3	33
6	true	6	16
7	false	3	33
8	true	8	12
9	false	3	33
10	true	10	10
RPS: 33 → 50 → 33 → 25 → 33 → 16 → 33 → 12 → 33 → 10
→ Counter resets, pattern repeats


✅ Use this to fine-tune throughput while breaking static detection thresholds.

---

### 🧨 Burst Pattern Execution: Delay Modeling


Configuration passed to .setBurst() / .setOptions() / .axiosControl()
```js
{
  slots: 10,
  delay: 2000,
  jitter: 40
}


#### ⏱️ Final Delay Calculation
```
Example 1: Jittered Micro-burst
Base delay = 1200ms (60%), Jitter = up to +800ms (40%), Time slots = 10 = (10th reset)
 ```js

 Config: { delay: 2000, jitter: 40, slots: 10 }
if (count % 10 === 0) {
  await new Promise(resolve => setTimeout(resolve, 1200 + Math.floor(Math.random() * 800)))
  count = 0;
}
```
 Example 2: Macro-burst (No Jitter, low frequency, long pause)
 Base delay = 6000ms (100%), Jitter (0%), Time slots = 30 = (30th Active)
 ```js

 Config: { delay: 6000, jitter: 0, slots: 30 }
if (count % 30 === 0) {
  await new Promise(resolve => setTimeout(resolve, 6000))
  count = 0;
}
```
____________________________________________________________________________________
|    Pattern Type    |     Execution Point    |          Effective Delay           |
|--------------------|------------------------|------------------------------------|
|    Micro Burst     |   Every 10th request   |    ~1200ms + random(0–800ms)       |
|    Macro Burst     |   Every 30th request   |     6000ms fixed (no jitter)       |
|  Competing Bursts  |   If multiple match    | Highest delay pattern is executed  |
------------------------------------------------------------------------------------
🧠 ARC resets burst counters after execution, ensuring **non-overlapping delay injection** even with multiple patterns. Perfect for simulating human-like traffic pacing or absorbent back-off windows.

---

### 📘 Pattern Design Workflow

- Start with `numerator`, `divisor`, and `frequency` to shape your sustained RPS curve.
- Layer to inject rhythm breaks at controlled request slot intervals.
- Set `reset` to time dynamic burst counters and simulate session phases.
- Combine with `isBatch = true` for concurrent peek / off peek burst pattern window.


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
🔄 **More features, patterns, and control modes coming soon.**  
ARC is under active re-construction expect frequent updates and architecture refinements.
