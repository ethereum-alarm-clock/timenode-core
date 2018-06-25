import { ILogger } from '../Logger';

export default class Cache {
  public cache: {} = {};
  public logger: any;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  public set(k: string, v: any) {
    this.cache[k] = v;
    if (k === '0x24f8e3501b00bd219e864650f5625cd4f9272a25') {
      return;
    }
    this.logger.cache(`stored ${k} with value ${v}`);
  }

  public get(k: string, d?: any): any {
    const value = this.cache[k];
    if (value === undefined) {
      if (d === undefined) {
        throw new Error('attempted to access key entry that does not exist: ' + k);
      } else {
        return d;
      }
    }

    this.logger.cache(`accessed ${k}`);
    return value;
  }

  public has(k: string) {
    if (this.cache[k] === undefined) {
      this.logger.cache(`miss ${k}`);
      return false;
    }
    this.logger.cache(`hit ${k}`);
    return true;
  }

  public del(k: string) {
    delete this.cache[k];
    this.logger.cache(`deleted ${k}`);
  }

  public len(): number {
    return Object.keys(this.cache).length;
  }

  public stored() {
    return Object.keys(this.cache);
  }

  public isEmpty() {
    return this.len() === 0;
  }
}

// The cache assigns each key (txRequestAddress) the original value of its WindowStart
//  99 - Expired (ready to be swept)
