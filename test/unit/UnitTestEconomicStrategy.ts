import BigNumber from 'bignumber.js';
import { expect, assert } from 'chai';
import { Config } from '../../src/index';
import { mockConfig, MockTxRequest } from '../helpers';
import { shouldClaimTx } from '../../src/EconomicStrategy';

describe('Economic Strategy Tests', () => {
  let config: Config;
  let txTimestamp: any;

  const reset = async () => {
    config = mockConfig();
    txTimestamp = await MockTxRequest(config.web3);
  };

  beforeEach(reset);

  describe('shouldClaimTx()', () => {
    it('returns true if economic strategy not set', async () => {
      config.economicStrategy = null;
      const shouldClaim = await shouldClaimTx(txTimestamp, config);
      assert.isTrue(shouldClaim);
    });

    it('returns true if economic strategy is zeroed', async () => {
      const shouldClaim = await shouldClaimTx(txTimestamp, config);
      assert.isTrue(shouldClaim);
    });

    it('returns false if transaction exceeds maxDeposit', async () => {
      config.economicStrategy.maxDeposit = new BigNumber(1);
      const shouldClaim = await shouldClaimTx(txTimestamp, config);
      assert.isFalse(shouldClaim);
    });

    it('returns false if balance below minBalance', async () => {
      config.economicStrategy.minBalance = new BigNumber(config.web3.toWei(101, 'ether'));
      const shouldClaim = await shouldClaimTx(txTimestamp, config);
      assert.isFalse(shouldClaim);
    });

    it('returns false if reward lower than minProfitability', async () => {
      config.economicStrategy.minProfitability = new BigNumber(config.web3.toWei(100, 'ether'));
      const shouldClaim = await shouldClaimTx(txTimestamp, config);
      assert.isFalse(shouldClaim);
    });
  });
});
