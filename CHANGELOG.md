## 1.5.0-custom
* Refactored internal implementation to singleton object pattern.
* Retained core request queue and rate limiting logic.
* Prepared groundwork for upcoming pause, jitter, and burst rate control features.

## 1.5.1-custom
* Added `trueRPS` tracking system with time-windowed reporting.
* Introduced `getTrueRPS(callback)` method to expose actual RPS per interval:
  ```js
  http.getTrueRPS((trueRPS, maxRPS) => {
    console.log('trueRPS:', trueRPS)
    console.log('maxRPS:', maxRPS)
  })
* Added `setCancelTokenAware()` to optionally enable safe cancel token handling.


## 1.5.2-custom
* Added instance tracking to `getTrueRPS(callback)` for multiple instance tracking.
* Added internal logic for per instance rate limiting and tracking.
```js
    this.instance.getTrueRPS((trueRPS, maxRPS, instance_counter) => {
        console.log('trueRPS:', trueRPS)
        console.log('maxRPS:', maxRPS)
        console.log('instance_counter:', instance_counter)
    })