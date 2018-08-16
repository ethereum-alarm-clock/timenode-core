import { BigNumber } from 'bignumber.js';

// TODO this is only temporary
export interface ITxRequest {
  address: string;
  gasPrice: BigNumber;

  refreshData(): Promise<any>;
}
