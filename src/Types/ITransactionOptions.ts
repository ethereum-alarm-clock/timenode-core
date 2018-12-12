import { BigNumber } from 'bignumber.js';
import { Operation } from './Operation';

export default interface ITransactionOptions {
  to: string;
  value: BigNumber;
  gas: BigNumber;
  gasPrice: BigNumber;
  data: string;
  operation: Operation;
}
