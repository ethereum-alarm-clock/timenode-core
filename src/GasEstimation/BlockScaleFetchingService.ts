import fetch from 'node-fetch';
import { IGasPriceFetchingService, GasPriceEstimation } from '../Types';
import BigNumber from 'bignumber.js';

export class BlockScaleFetchingService implements IGasPriceFetchingService {
  private apiAddress = 'https://dev.blockscale.net/api/gasexpress.json';

  public async fetchGasPrice(): Promise<GasPriceEstimation> {
    const response = await fetch(this.apiAddress);

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const json = await response.json();

    return {
      average: new BigNumber(json.standard),
      fast: new BigNumber(json.fast),
      fastest: new BigNumber(json.fastest),
      safeLow: new BigNumber(json.safeLow)
    };
  }
}
