import fetch from 'node-fetch';
import { IGasPriceFetchingService, BlockScaleInfo } from '../Types';
import BigNumber from 'bignumber.js';

export class BlockScaleFetchingService implements IGasPriceFetchingService {
  private apiAddress = 'https://dev.blockscale.net/api/gasexpress.json';

  public async fetchGasPrice(): Promise<BlockScaleInfo> {
    const response = await fetch(this.apiAddress);

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const json = await response.json();

    const toGwei = (val: number) => {
      const gwei = 1000000000;
      return val * gwei;
    };

    return {
      average: new BigNumber(toGwei(json.standard)),
      fast: new BigNumber(toGwei(json.fast)),
      fastest: new BigNumber(toGwei(json.fastest)),
      safeLow: new BigNumber(toGwei(json.safeLow))
    };
  }
}
