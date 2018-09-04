import { BigNumber } from 'bignumber.js';

export default interface ITransactionOptions {
  to: string;
  value: BigNumber;
  gas: number;
  gasPrice: BigNumber;
  data: string;
}
