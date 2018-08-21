import { ILogger } from '../Logger';
import BigNumber from 'bignumber.js';

export interface IPool {
  [id: string]: boolean | ITxPoolTxDetails;
}

export interface ITxPoolTxDetails {
    to: string;
    from: string;
    input: string;
    gasPrice: BigNumber;
    timestamp: number;
    transactionHash: string;
}

export class Pool {
  public pool: IPool = {};

  public preSet(key: string): boolean {
    if (this.pool[key]) {
      return false;
    }
    return this.pool[key] = true;
  }

  public set(key: string, value: ITxPoolTxDetails) {
    this.pool[key] = value;
  }

  public get(key: string, field: string): (boolean | ITxPoolTxDetails)[] {
    return this.stored().filter((p: string) =>
      (field === 'transactionHash' && p === key) || this.pool[p][field] === key)
      .map((found: string) => this.pool[found])
  }

  public has(key: string, field: string): boolean {
    return this.get(key, field).length > 0;
  }

  public del(key: string) {
    delete this.pool[key];
  }

  public wipe() {
    this.pool = {};
  }

  public length(): number {
    return this.stored().length;
  }

  public stored(): string[] {
    return Object.keys(this.pool);
  }

  public isEmpty() {
    return this.length() === 0;
  }
}

// Local copy of the transaction pool known to the node
// This is maintained while TimeNode is running
