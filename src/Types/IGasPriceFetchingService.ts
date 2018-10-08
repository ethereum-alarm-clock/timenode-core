import { BigNumber } from 'bignumber.js';

export interface IGasPriceFetchingService {
  fetchGasPrice(): Promise<GasPriceEstimation>;
}

export interface GasPriceEstimation {
  safeLow: BigNumber;
  standard: BigNumber;
  fast: BigNumber;
  fastest: BigNumber;
}
