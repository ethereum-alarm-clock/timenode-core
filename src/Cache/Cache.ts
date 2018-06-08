import * as mem_cache from 'memory-cache';
import * as _ from 'lodash';

export default class Cache {
  cache: any;
  logger: any;
  mem: any;

  constructor(logger: any) {
    this.cache = new mem_cache.Cache();
    this.logger = logger;
    this.mem = [];
  }

  set(k, v) {
    if (_.indexOf(this.mem, k) === -1) {
      this.mem.push(k);
    }
    this.cache.put(k, v); // , timeout, this.del(k))
    this.logger.cache(`stored ${k} with value ${v}`);
  }

  get(k, d?) {
    // / FIXME more elegant error handling for this...
    if (this.cache.get(k) === null) {
      if (d === undefined) {
        throw new Error('attempted to access key entry that does not exist');
      } else return d;
    }

    this.logger.cache(`accessed ${k}`);
    return this.cache.get(k);
  }

  has(k) {
    if (this.cache.get(k) === null) {
      this.logger.cache(`miss ${k}`);
      return false;
    }
    this.logger.cache(`hit ${k}`);
    return true;
  }

  del(k) {
    // mutates the this.mem array to remove the value
    _.remove(this.mem, (addr) => addr === k);
    this.cache.del(k);
    this.logger.cache(`deleted ${k}`);
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
    console.log('sweepexpired');
    this.mem.forEach((txRequestAddress) => {
      if (this.get(txRequestAddress, 0) === 99) {
        // expired
        this.del(txRequestAddress);
      }
    });
  }
}

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
