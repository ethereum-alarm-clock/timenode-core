import { ILogger, DefaultLogger } from '../Logger';
import BigNumber from 'bignumber.js';
import { Config } from '..';

export interface ICachedTxDetails {
  claimedBy: string;
  wasCalled: boolean;
  windowStart: BigNumber;
}

export default class Cache<T> {
  public cache: {} = {};
  public logger: any;

  constructor(logger: ILogger = new DefaultLogger()) {
    this.logger = logger;
  }

  public set(key: string, value: T) {
    this.cache[key] = value;
  }

  public get(key: string, fallback?: any): T {
    const value = this.cache[key];
    if (value === undefined) {
      if (fallback === undefined) {
        throw new Error('attempted to access key entry that does not exist: ' + key);
      }

      return fallback;
    }

    return value;
  }

  public has(key: string) {
    if (this.cache[key] === undefined) {
      return false;
    }
    return true;
  }

  public del(key: string) {
    delete this.cache[key];
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

  public getTxRequestsClaimedBy(address: string, config: Config): string[] {
    const storedInCache = this.stored();
    if (!storedInCache) {
      return [''];
    }

    return storedInCache
      .filter((txRequestAddress: string) => {
        const cached = this.get(txRequestAddress);

        return cached;
      })
      .filter(async (txRequestAddress: string) => {
        const txRequest = await config.eac.transactionRequest(txRequestAddress);
        await txRequest.refreshData();
        return txRequest.claimedBy === address;
      });
  }
}

// The cache assigns each key (txRequestAddress) the original value of its WindowStart
//  99 - Expired (ready to be swept)
