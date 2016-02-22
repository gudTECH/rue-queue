/*jslint node: true */
"use strict";

class RueQueue {
  constructor(params) {
    if (typeof params.maxsize !== 'number' || params.maxsize < 1) {
      throw "must set maxsize";
    } else if (typeof params.callback !== 'function') {
      throw "must set callback function";
    } else if (typeof params.name !== 'string' || params.name.length === 0) {
      throw "must provide name";
    }

    console.log("creating RueQueue", params.name);

    this.name = params.name;
    this._queue = [];
    this.maxsize = params.maxsize;
    this.callback = params.callback;
    this.retryWait = params.retryWait || 5000;
    this.verbose = params.verbose || false;
    this._drainRetryTimer = null;
  }

  log() {
    console.log(`RueQueue(${this.name})`, ...arguments);
  };

  push(val,doDrain) {
    if (this._queue.length+1 > this.maxsize) {

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

    // if they don't specify anything assume 'drain'
    if (typeof doDrain === 'undefined') {
      this._drain();
    }
  }

  pushNoDrain(val) {
    this.push(val,false);
  }

  success() {
    this._queue.pop();
    this._drain();
  }

  error() {
    this.resetDrainRetryTimer();
  }

  _drain() {
    if (this._queue.length === 0) {
      return; // We stop trying to process messages until more are enqueued
    }

    var entry = this._queue[this._queue.length-1]; // peek
    try {
      this.callback(entry,this);
    } catch(e) {
      this.log(`callback died with: ${e}`);
      this.resetDrainRetryTimer();
    }
  }

  resetDrainRetryTimer() {
    clearTimeout(this._drainRetryTimer);
    this._drainRetryTimer = setTimeout(() => this._drain(), this.retryWait);
  }
}

module.exports = function(params) {
  return new RueQueue(params);
};
