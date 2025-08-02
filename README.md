⚠️ DEVELOPMENT WARNING: This package is currently under active refactor and restructuring. NOT currently production-ready.
Core features and APIs may change without notice.

## Axios-Rate-Control

> Forked from `axios-rate-limit`

This module emerged from a real-world ingestion pipeline

Although some RPS limits seem reasonable (e.g 50 RPS - TMDB),
Steady sustained request rates within advertised limits yield significantly lower through-put.
By introducing dynamic RPS shifting, utilizing peek request burst tolerance with short pause jitter patterns and cool-off periods,
A far higher RPS can be sustained over extended periods.

Below are metrics achieved ARC v1 - 100% verified repeatable results.

- 'Pipeline running': '1463s',
- 'Requests': 2.33M
- 'Items processed': 45.19M - (average 20 results/req)
- 'Avg RPS Distributed': 1591.53 - (Req/Time - full duration - 6 fetcher classes/API keys )
- 'Categories completed': 235/235 - (Genre endpoints generated from combinations of id,id)

> (From stage 1 ingestion pipeline - suzieViews database... Also Coming soon)

---

## 📦 Axios-Rate-Control

A modular control layer for deterministic, burst-aware traffic shaping.  
Provides runtime orchestration, visibility, and per-instance configuration.

## 🧮 Pattern Calculation & Execution Guide

This section explains how to **calculate**, **predict**, and **simulate** the internal request patterning logic based on ARC's configuration parameters.
So you may design precise traffic shapes that match your ingestion or throttle strategy.

### 📘 Pattern Design Workflow

- Start with `numerator`, `divisor`, and `frequency` to shape your sustained RPS curve.
- Layer to inject rhythm breaks at controlled request slot intervals.
- Set `reset` to time dynamic burst counters and simulate session phases.
- Combine with `isBatch = true` for concurrent peek / off peek burst pattern window.

##

### 🎯 Dynamic RPS Modulation: Formula Breakdown

| Parameter   | Function                         |
| ----------- | -------------------------------- |
| `numerator` | Base RPS value                   |
| `frequency` | Switch `counter`/`divisor` ratio |
| `divisor`   | Fixed alternate ternary divisor  |
| `reset`     | Sets decrement steps until reset |

##

### 📈 RPS Progression Example

**Config:** numerator: 160, frequency: 2, divisor: 3, reset: 30

**Pattern:** `53 → 80 → 53 → 40 → 53 → 26 → 53 → 20 → 53 → 16 → 53 → 13 → 53 → 11 → 53 → 10 → 53 → 9...`

| Tick | `% frequency === 0` | Divisor | Expression | RPS |
| ---- | ------------------- | ------- | ---------- | --- |
| 1    | false               | 3       | 160 / 3    | 53  |
| 2    | true                | 2       | 160 / 2    | 80  |
| 3    | false               | 3       | 160 / 3    | 53  |
| 4    | true                | 4       | 160 / 4    | 40  |
| 5    | false               | 3       | 160 / 3    | 53  |
| 6    | true                | 6       | 160 / 6    | 26  |
| 7    | false               | 3       | 160 / 3    | 53  |
| 8    | true                | 8       | 160 / 8    | 20  |
| 9    | false               | 3       | 160 / 3    | 53  |
| 10   | true                | 10      | 160 / 10   | 16  |
| ...  | ...                 | ...     | ...        | ... |
| 30   | true                | 30      | 160 / 30   | 5   |

→ Counter resets at 30, pattern repeats

```js
// ARC's Internal with (setDynamic: true)
const rps = Math.floor(
  numerator / (++counter % frequency === 0 ? counter : divisor)
);
reset === counter ? (counter = 0) : null;
```

---

### 💥 Burst Pattern Execution: Delay Modeling

| Pattern Type | Execution Point | Effective Delay          |
| ------------ | --------------- | ------------------------ |
| Micro Burst  | Every 3rd slot  | ~600ms + random(0–400ms) |
| Macro Burst  | Every 30th slot | 6000ms fixed (no jitter) |

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
  await new Promise((resolve) =>
    setTimeout(resolve, 600 + Math.floor(Math.random() * 400))
  );
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
  await new Promise((resolve) => setTimeout(resolve, 6000));
  count = 0;
}
```

---

## 🚀 Combined Dynamic RPS + Dual Burst Pattern Execution

`numerator: 160, frequency: 2, divisor: 3`
`{ delay: 1000, jitter: 40, slots: 3 }`,
`{ delay: 6000, jitter: 0, slots: 30 }`

| Tick | RPS | Window Duration  | Burst Type | Notes                 |
| ---- | --- | ---------------- | ---------- | --------------------- |
| 1    | 53  | 1.00s            | None       | Base rate (160/3)     |
| 2    | 80  | 1.00s            | None       | Frequency boost       |
| 3    | 53  | 1.00s + 0.6-1.0s | Micro      | 3-slot burst          |
| 4    | 40  | 1.00s            | None       | Counter increment     |
| 5    | 53  | 1.00s            | None       | Divisor pattern       |
| 6    | 26  | 1.00s + 0.6-1.0s | Micro      | 3-slot burst          |
| 7    | 53  | 1.00s            | None       | Post-burst resume     |
| 8    | 20  | 1.00s            | None       | Lower RPS phase       |
| 9    | 53  | 1.00s + 0.6-1.0s | Micro      | 3-slot burst          |
| 10   | 16  | 1.00s            | None       | Minimum RPS           |
| 12   | 80  | 1.00s + 0.6-1.0s | Micro      | 3-slot burst          |
| ...  | ... | ...              | ...        | ...                   |
| 30   | 16  | 1.00s + 6.0s     | **Macro**  | **30-slot cool-down** |
| 31   | 53  | 1.00s            | None       | Post-cool-down        |

- **Micro bursts**: Every 3rd tick adds 0.6-1.0s jittered delay
- **Macro cool-down**: Every 30th tick adds 6.0s fixed delay
- **Priority**: Macro overrides micro when both trigger simultaneously

## ⚙️ Axios-Rate-Control API Surface

A modular control layer for deterministic, burst-aware traffic shaping.  
Provides runtime orchestration, visibility, and per-instance configuration.

### 🔧 Available Methods

```js
http.axiosControl(); // Configure and attach ARC with config options
http.getMaxRPS(); // Concurrent batch size / RPS alignment
http.setMaxRPS(); // Runtime RPS modification / modulation
http.setBatch(); // Switching sequential / concurrent with config options
http.setBurst(); // Runtime burst pattern modulation config
http.getQueue(); // Returns reference to current enqueued array
http.queueDump(); // Returns and clears enqueued array and safely cancels requests
http.getStats(); // Returns stats trueRPS, maxRPS, ARC instance ID
http.setID(); // Sets custom ARC instance ID
```

---

## ✅ Full Initial Config. See Below For Details.

```js
// Attaching ARC
http.axiosControl(axios.create(), {
  isBatch: true,
  setDynamic: true,
  numerator: 160,
  frequency: 2,
  divisor: 3,
  reset: 30,
  isBurst: true,
  patterns: [
    { delay: 2000, jitter: 40, slots: 10 },
    { delay: 6000, slots: 30 },
  ],
});
```

## 🧱 Basic Rate Limiting. Sequential / Batch.

Sequential mode can be run as

- Unified: A singleton object shared by all attached axios instances and can not be switched after initializing.
- Normal: Per axios instance ARC attachment config.
- Dynamic: Sequential requests with switchable dynamic/fixed RPS pattern.

```js
// Unified: true for singleton operation (sequential only). Otherwise omit unified key.

http.axiosControl(axios.create(), {
  unified: true,
  maxRPS: 50,
});

// Sequential may use dynamic RPS but must not be unified.
http.axiosControl(axios.create(), {
  isDynamic: true,
  numerator: 100,
  frequency: 2,
  divisor: 3,
  reset: 10,
});
```

Batch mode may be configured by

- Basic: maxRPS blocks dynamic mode, see setMaxRPS.
- Dynamic: Using dynamic RPS which may also be changed on-the-fly or switched to fixed.
- Dynamic Burst: Using dynamic RPS with any combination of burst / jitter pattern.

```js
// Basic set using maxRPS as below

http.axiosControl(axios.create(), {
  isBatch: true,
  maxRPS: 50,
});

// With dynamic RPS set true. maxRPS may not be used

http.axiosControl(axios.create(), {
  isBatch: true,
  isDynamic: true,
  numerator: 100,
  frequency: 2,
  divisor: 3,
  reset: 10,
});
```

Sequential and batch mode on-the-fly RPS switching

- Basic: Simply passing the desired RPS.
- Dynamic: Passing parameters when isDynamic: true.
- Dynamic: ARC also allows for custom logic dynamic RPS.
- Switching

```js
  .setMaxRPS()
  // Hot RPS change

  http.setMaxRPS(30) // Changes RPS in basic limiter mode.
  http.setMaxRPS({ numerator: 160, divisor: 3, frequency: 2, reset: 30 }) // Changes RPS in dynamic mode.
  http.setMaxRPS(/* Custom Logic */)

```

Batch requests with ARC ❗Must use getMaxRPS method. Batch requests = RPS

- Basic: Must use getMaxRPS.
- Dynamic: Must use getMaxRPS.
- Custom: Must use getMaxRPS or result of custom RPS logic.

```js
// Batch mode concurrent requests
const batchSize = http.getMaxRPS();
const promises = [];
for (let i = 0; i < batchSize; i++) {
  promises.push(http.get(`/api/data?page=${i + 1}`));
}
Promise.all(promises); // promises.length === getMaxRPS
```

### Runtime Mode Switching

Batch / Sequential mode may be toggled at runtime with RPS mode option.
When switching from sequential to batch mode you may also set queueDump: true which will return the current enqueued requests
which will resolve `false` instead of actual data.
The returned queue items contain the original request configurations, allowing you to re-submit cancelled requests.

```js
  .setBatch()
  // Hot mode switching

  http.setBatch(false) // Switches to sequential mode.
  http.setBatch(true)  // Switches to batch mode.
  http.setBatch(true, 30) // Switches to batch mode + RPS to 30.
  http.setBatch(true, { numerator: 160, frequency: 2, divisor: 3, reset: 30 }) // Sets batch mode + dynamic RPS.
  http.setBatch(true, { queueDump: true }) // Sets batch mode + clears and returns the existing request queue.
  http.setBatch(true, { isDynamic: true, numerator: 160, frequency: 2, divisor: 3, reset: 30, queueDump: true }) // Combined dynamic mode use

```

 

```js
  .setBurst()

  http.setBurst({
    isBurst: true,
    patterns: [
      { delay: 2000, jitter: 40, slots: 6 },
      { delay: 6000, jitter: 0, slots: 30 }
    ]
  })
```

```js
.getStats()
// Stats Report

console.log(http.getStats()) // Returns the most recent tick metrics:
{
  "trueRPS": number, // trueRPS: Number of requests executed in the previous tick
  "maxRPS": number, // Configured rate per second
  "instanceID": number | 'singleton' // ARC instance number or "singleton" if shared
}

```
---



🔄 **More features, patterns, and control modes coming soon.**  
ARC is under active re-construction expect frequent updates and architecture refinements.
Sequential and Batch mode allows on-the-fly RPS switching.
icon folder



- Configurable settings via JSON

Files & Structure
📁 Folder

🗂️ File Group

🧱 Component

🧾 Logs

🧩 Plugin

Development
⚙️ Config

🔧 Tools

📦 Package

💻 Code

🧪 Tests

Docs & Info
📝 Docs

📚 Reference

📊 Metrics

ℹ️ Info

Project / Meta
🚀 Launch

🧠 Idea
💥 for aggressive/high RPS burst

🚀 for launch/speed burst

💨
⛏️ Work in progress

✅ Done

❌ Deprecated

🔥 Hotfix

🧨
