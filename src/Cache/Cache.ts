import { ILogger } from '../Logger';

export default class Cache {
  cache: {} = {};
  logger: any;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  set(k: string, v: any) {
    this.cache[k] = v;
    this.logger.cache(`stored ${k} with value ${v}`);
  }

  get(k: string, d?: any): any {
    const value = this.cache[k];
    if (value === undefined) {
      if (d === undefined) {
        throw new Error(
          'attempted to access key entry that does not exist: ' + k
        );
      } else return d;
    }

    this.logger.cache(`accessed ${k}`);
    return value;
  }

  has(k: string) {
    if (this.cache[k] === undefined) {
      this.logger.cache(`miss ${k}`);
      return false;
    }
    this.logger.cache(`hit ${k}`);
    return true;
  }

  del(k: string) {
    delete this.cache[k];
    this.logger.cache(`deleted ${k}`);
  }

  len(): number {
    return Object.keys(this.cache).length;
  }

  stored() {
    return Object.keys(this.cache);
  }

  isEmpty() {
    return this.len() === 0;
  }
}

// The cache assigns each key (txRequestAddress) the original value of its WindowStart
//  99 - Expired (ready to be swept)
