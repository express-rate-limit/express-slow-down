"use strict";

function calculateNextResetTime(windowMs) {
  const d = new Date();
  d.setMilliseconds(d.getMilliseconds() + windowMs);
  return d;
}

function MemoryStore(windowMs) {
  !global._hits && (global._hits = {});
  let resetTime = calculateNextResetTime(windowMs);

  this.incr = function (key, cb) {
    if (global._hits[key]) {
      global._hits[key]++;
    } else {
      global._hits[key] = 1;
    }

    cb(null, global._hits[key], resetTime);
  };

  this.decrement = function (key) {
    if (global._hits[key]) {
      global._hits[key]--;
    }
  };

  // export an API to allow global._hits all IPs to be reset
  this.resetAll = function () {
    global._hits = {};
    resetTime = calculateNextResetTime(windowMs);
  };

  // export an API to allow global._hits from one IP to be reset
  this.resetKey = function (key) {
    delete global._hits[key];
    delete resetTime[key];
  };

  // simply reset ALL global._hits every windowMs
  const interval = setInterval(this.resetAll, windowMs);
  if (interval.unref) {
    interval.unref();
  }
}

module.exports = MemoryStore;
