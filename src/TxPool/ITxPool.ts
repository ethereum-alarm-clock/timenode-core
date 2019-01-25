import BigNumber from 'bignumber.js';
import { Operation } from '../Types/Operation';

export interface ITxPoolTxDetails {
  to: string;
  gasPrice: BigNumber;
  timestamp: number;
  operation: Operation;
}

export interface ITxPool {
  pool: Map<string, ITxPoolTxDetails>;
  running(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}
