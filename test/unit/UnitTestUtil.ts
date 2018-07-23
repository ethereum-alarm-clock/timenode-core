import { expect, assert } from 'chai';
import { Config } from '../../src/index';
import { mockConfig } from '../helpers';
import W3Util from '../../src/Util';

describe('Util Unit Tests', () => {
  const config: Config = mockConfig();
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
});
