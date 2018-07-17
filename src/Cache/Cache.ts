import { ILogger } from '../Logger';
import BigNumber from 'bignumber.js';

export interface ICachedTxDetails {
  claimedBy: string;
  wasCalled: boolean;
  windowStart: BigNumber;
}

export default class Cache {
  public cache: {} = {};
  public logger: any;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  public set(key: string, value: ICachedTxDetails) {
    this.cache[key] = value;
    this.logger.cache(`stored ${key} with value ${value.windowStart}`);
  }

  public get(key: string, fallback?: any): ICachedTxDetails {
    const value = this.cache[key];
    if (value === undefined) {
      if (fallback === undefined) {
        throw new Error('attempted to access key entry that does not exist: ' + key);
      }

      return fallback;
    }

    this.logger.cache(`accessed ${key}`);
    return value;
  }

  public has(key: string) {
    if (this.cache[key] === undefined) {
      this.logger.cache(`miss ${key}`);
      return false;
    }
    this.logger.cache(`hit ${key}`);
    return true;
  }

  public del(key: string) {
    delete this.cache[key];
    this.logger.cache(`deleted ${key}`);
  }

  public length(): number {
    return this.stored().length;
  }

  public stored() {
    return Object.keys(this.cache);
  }

  public isEmpty() {
    return this.length() === 0;
  }
}

// The cache assigns each key (txRequestAddress) the original value of its WindowStart
//  99 - Expired (ready to be swept)
