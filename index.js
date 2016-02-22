/*jslint node: true */
"use strict";

class RueQueue {
  constructor(params) {
    if (typeof params.maxsize !== 'number' || params.maxsize < 1) {
      throw new Error("must set maxsize");
    } else if (typeof params.callback !== 'function') {
      throw new Error("must set callback function");
    }

    this._queue = [];
    this.maxsize = params.maxsize;
    this.callback = params.callback;
    this.concurrency = params.concurrency || 10;
    this.inflight = 0;
    this.cooldown = false;
    this.retryWait = params.retryWait || 5000;
    this._drainRetryTimer = null;
  }

  push(val, drain) {
    if (this._queue.length + 1 > this.maxsize) {
      var maybe_regret = this._queue.pop(); // end of the array is the oldest data
      if (typeof maybe_regret._regrets !== 'undefined') {
        this._queue.pop(); // get rid of the oldest data
        maybe_regret._regrets += 1;
        this._queue.push(maybe_regret);
      } else {
        this._queue.push({_regrets: 1});
      }
    }

    this._queue.unshift(val);

    if (drain !== false) {
      this._drain();
    }
  }

  _drain() {
    process.nextTick(() => {
      while (this._queue.length > 0 && this.inflight < this.concurrency && !this.cooldown) {
        this._send();
      }
    });
  }

  _send() {
    let entry = this._queue.pop();
    let done = false;
    let ack = (succeeded) => {
      if (done) return;
      done = true;
      this.inflight -= 1;
      this._drain();
      if (!succeeded) {
        this._queue.push(entry);
        this.cooldown = true;
        clearTimeout(this._drainRetryTimer);
        this._drainRetryTimer = setTimeout(() => {
          this.cooldown = false;
          this._drain();
        }, this.retryWait);
      }
    };
    this.inflight += 1;
    this.callback(entry, {
      success: () => ack(true),
      error: () => ack(false),
    });
  }
}

module.exports = function(params) {
  return new RueQueue(params);
};
