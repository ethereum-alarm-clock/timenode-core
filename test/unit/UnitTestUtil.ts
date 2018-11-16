import { expect, assert } from 'chai';
import { Config } from '../../src/index';
import { mockConfig } from '../helpers';
import W3Util from '../../src/Util';

describe('Util Unit Tests', async () => {
  const config: Config = await mockConfig();
  const util: W3Util = new W3Util(config.web3);

  describe('estimateGas()', () => {
    it('returns a number', async () => {
      const gas = await util.estimateGas({});
      assert.isTrue(typeof gas === 'number');
    });
  });

  describe('networkGasPrice()', () => {
    it('returns a number', async () => {
      const networkGasPrice = await util.networkGasPrice();
      assert.isTrue(networkGasPrice.greaterThan(0));
    });
  });

  describe('getAdvancedNetworkGasPrice()', () => {
    it('returns an object containing BigNumber', async () => {
      const advNetworkGasPrice = await util.getAdvancedNetworkGasPrice();
      const expectedFields = ['average', 'fast', 'fastest', 'safeLow'];

      expectedFields.forEach(field => {
        assert.isTrue(advNetworkGasPrice[field].greaterThan(config.web3.toWei('0.05', 'gwei')));
      });
    });
  });

  describe('getBlockNumber()', () => {
    it('returns a block number', async () => {
      const blockNum = await util.getBlockNumber();
      assert.isTrue(typeof blockNum === 'number');
    });
  });

  describe('getBlock()', () => {
    it('returns a block', async () => {
      const block = await util.getBlock();
      assert.isTrue(block.number === (await util.getBlockNumber()));
    });

    it('returns a error when no block found for block number', async () => {
      const blockNumber = 1000000000;
      let err = '';

      try {
        await util.getBlock(blockNumber);
      } catch (e) {
        err = e;
      }

      expect(err).to.equal(`Returned block ${blockNumber} is null`);
    });
  });

  describe('isWatchingEnabled()', () => {
    it('returns true when watching', async () => {
      const watching = await util.isWatchingEnabled();
      assert.isTrue(watching);
    });
  });

  describe('getAverageBlockTime()', () => {
    it('returns the average blocktime of last 100 blocks', async () => {
      const avgBlockTime = await util.getAverageBlockTime();
      assert.isNumber(avgBlockTime);
      assert.isAbove(avgBlockTime, 0);
    });
  });
});
