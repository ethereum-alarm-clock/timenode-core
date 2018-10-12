import { assert } from 'chai';

import { BlockScaleFetchingService, EthGasStationFetchingService } from '../../src/GasEstimation';
import BigNumber from 'bignumber.js';

describe('Gas Price Estimation Tests', () => {
  describe('BlockScaleFetchingService', async () => {
    const blockscale = new BlockScaleFetchingService();
    const result = await blockscale.fetchGasPrice();

    Object.keys(result).forEach(field => {
      assert.isTrue(result[field] instanceof BigNumber, `${field} is not a BigNumber!`);
    });

    assert.isTrue(result.safeLow <= result.average);
    assert.isTrue(result.average <= result.fast);
    assert.isTrue(result.fast <= result.fastest);
  });

  describe('EthGasStationFetchingService', async () => {
    const ethGasStaion = new EthGasStationFetchingService();

    const result = await ethGasStaion.fetchGasPrice();

    Object.keys(result).forEach(field => {
      assert.isTrue(result[field] instanceof BigNumber, `${field} is not a BigNumber!`);
    });

    assert.isTrue(result.safeLow <= result.average);
    assert.isTrue(result.average <= result.fast);
    assert.isTrue(result.fast <= result.fastest);
  });
});
