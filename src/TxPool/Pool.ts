import { ILogger } from '../Logger';
import BigNumber from 'bignumber.js';

export interface ITxPoolTxDetails {
    to: string;
    from: string;
    input: string;
    gasPrice: BigNumber;
    timestamp: Number;
    transactionHash: string;
}

export class Pool<T> {
  public pool: any = [];

  public set(key: string, value: ITxPoolTxDetails) {
    this.pool[key] = value;
  }

  public get(key: string, field: string): [ITxPoolTxDetails] {
    const found = this.pool.filter((p: any) => p[field] === key);
    return found;
  }

  public has(key: string, field: string) {
    return this.get(key, field).length > 0;
  }

  public del(key: string) {
    delete this.pool[key];
  }

  public wipe() {
    this.pool = [];
  }

  public length(): number {
    return this.pool.length;
  }

  public stored() {
    return Object.keys(this.pool);
  }

  public isEmpty() {
    return this.length() === 0;
  }
}

// Local copy of the transaction pool known to the node
// This is maintained while TimeNode is running
