const mem_cache = require("memory-cache");
const _ = require("lodash");

// wrapper over memory-cache
class Cache {
  constructor(logger) {
    this.log = logger;
    this.cache = new mem_cache.Cache();
    this.mem = [];
  }

  set(k, v) {
    if (_.indexOf(this.mem, k) === -1) {
      this.mem.push(k);
    }
    this.cache.put(k, v); // , timeout, this.del(k))
    this.log.cache(`stored ${k} with value ${v}`);
  }

  get(k, d) {
    // / FIXME more elegant error handling for this...
    if (this.cache.get(k) === null) {
      if (d === undefined) {
        throw new Error("attempted to access key entry that does not exist");
      } else return d;
    }

    this.log.cache(`accessed ${k}`);
    return this.cache.get(k);
  }

  has(k) {
    if (this.cache.get(k) === null) {
      this.log.cache(`miss ${k}`);
      return false;
    }
    this.log.cache(`hit ${k}`);
    return true;
  }

  del(k) {
    // mutates the this.mem array to remove the value
    _.remove(this.mem, addr => addr === k);
    this.cache.del(k);
    this.log.cache(`deleted ${k}`);
  }

  len() {
    return this.cache.size();
  }

  stored() {
    return this.mem;
  }

  isEmpty() {
    if (this.len() === 0) return true;
    return false;
  }

  sweepExpired() {
    this.mem.forEach(txRequestAddress => {
      if (this.get(txRequestAddress) === 99) {
        // expired
        this.del(txRequestAddress);
      }
    });
  }
}

module.exports = Cache;

// The cache assigns each key (txRequestAddress) the original value of its WindowStart
// During certain conditions it will change the value
// 105 - Failed Execution call (Attempt again)
// 104 - UNIMPLEMENTED
// 103 - Failed Claim call (Attempt again)
// 102 - Attempted Claim call (will not attempt again until result)
// 101 - UNIMPLEMENTED
// 100 - Successful Execution call (ready to be expired)
//  99 - Expired (ready to be swept)
//  -1 - Failed Execution call (will not attempt again)
