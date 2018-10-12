import { assert } from 'chai';
import { Config } from '../../src/index';
import { mockConfig } from '../helpers';
import { BlockScaleFetchingService, EthGasStationFetchingService } from '../../src/GasEstimation';
import BigNumber from 'bignumber.js';

describe('Gas Price Estimation Tests', async () => {
  const config: Config = await mockConfig();

  const gasPriceValues = ['average', 'fast', 'fastest', 'safeLow'];

  describe('BlockScaleFetchingService', async () => {
    const blockscale = new BlockScaleFetchingService();
    const result = await blockscale.fetchGasPrice();

    Object.keys(result).forEach(field => {
      assert.isTrue(result[field] instanceof BigNumber, `${field} is not a BigNumber!`);
    });

    gasPriceValues.forEach(value => {
      assert.isTrue(result[value] > config.web3.toWei('0.05', 'gwei'));
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

    gasPriceValues.forEach(value => {
      assert.isTrue(result[value] > config.web3.toWei('0.05', 'gwei'));
    });

    assert.isTrue(result.safeLow <= result.average);
    assert.isTrue(result.average <= result.fast);
    assert.isTrue(result.fast <= result.fastest);
  });
});
