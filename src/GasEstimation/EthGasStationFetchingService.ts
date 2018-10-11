import fetch from 'node-fetch';
import { BigNumber } from 'bignumber.js';

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

export class EthGasStationFetchingService {
  private apiAddress = 'https://ethgasstation.info/json/ethgasAPI.json';

  public async fetchGasPrice(): Promise<EthGasStationInfo> {
    const response = await fetch(this.apiAddress);

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const {
      average,
      avgWait,
      block_time,
      fast,
      fastWait,
      fastest,
      fastestWait,
      safeLow,
      safeLowWait
    } = await response.json();

    const toGwei = (val: number): number => {
      const gwei = 1000000000;
      return (val * gwei) / 10;
    };

    return {
      average: new BigNumber(toGwei(average)),
      avgWait: new BigNumber(avgWait),
      blockTime: new BigNumber(block_time),
      fast: new BigNumber(toGwei(fast)),
      fastWait: new BigNumber(fastWait),
      fastest: new BigNumber(toGwei(fastest)),
      fastestWait: new BigNumber(fastestWait),
      safeLow: new BigNumber(toGwei(safeLow)),
      safeLowWait: new BigNumber(safeLowWait)
    };
  }
}
