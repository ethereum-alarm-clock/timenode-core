import { BigNumber } from 'bignumber.js';

export interface IGasPriceFetchingService {
  fetchGasPrice(): Promise<GasPriceEstimation>;
}

export type GasPriceEstimation = EthGasStationInfo | BlockScaleInfo;

export interface EthGasStationInfo {
  average: BigNumber;
  avgWait: BigNumber;
  blockTime: BigNumber;
  fast: BigNumber;
  fastWait: BigNumber;
  fastest: BigNumber;
  fastestWait: BigNumber;
  safeLow: BigNumber;
  safeLowWait: BigNumber;
}

export interface BlockScaleInfo {
  average: BigNumber;
  fast: BigNumber;
  fastest: BigNumber;
  safeLow: BigNumber;
}
