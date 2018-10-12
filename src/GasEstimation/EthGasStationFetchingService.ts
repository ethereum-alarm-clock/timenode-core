import fetch from 'node-fetch';
import { BigNumber } from 'bignumber.js';
import { IGasPriceFetchingService, EthGasStationInfo } from '../Types';

export class EthGasStationFetchingService implements IGasPriceFetchingService {
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

    const toWei = (val: number): number => {
      const gwei = 1000000000;
      return (val * gwei) / 10;
    };

    return {
      average: new BigNumber(toWei(average)),
      avgWait: new BigNumber(avgWait),
      blockTime: new BigNumber(block_time),
      fast: new BigNumber(toWei(fast)),
      fastWait: new BigNumber(fastWait),
      fastest: new BigNumber(toWei(fastest)),
      fastestWait: new BigNumber(fastestWait),
      safeLow: new BigNumber(toWei(safeLow)),
      safeLowWait: new BigNumber(safeLowWait)
    };
  }
}
