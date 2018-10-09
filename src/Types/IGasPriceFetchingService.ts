import { BigNumber } from 'bignumber.js';

export interface IGasPriceFetchingService {
  fetchGasPrice(): Promise<GasPriceEstimation>;
}

export interface GasPriceEstimation {
  average: BigNumber;
  fast: BigNumber;
  fastest: BigNumber;
  safeLow: BigNumber;
}
