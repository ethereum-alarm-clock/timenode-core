import BigNumber from 'bignumber.js';
import { assert } from 'chai';
import { Config } from '../../src/index';
import { mockConfig, MockTxRequest } from '../helpers';
import { shouldClaimTx, getExecutionGasPrice } from '../../src/EconomicStrategy';

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

  describe('getExecutionGasPrice()', () => {
    it('returns current network price if economic strategy not set', async () => {
      config.economicStrategy = null;
      const currentNetworkPrice = await config.util.networkGasPrice();
      const gasPrice = await getExecutionGasPrice(txTimestamp, config);
      assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
    });

    it('returns current network price if maxGasSubsidy not set', async () => {
      config.economicStrategy.maxGasSubsidy = null;
      const currentNetworkPrice = await config.util.networkGasPrice();
      const gasPrice = await getExecutionGasPrice(txTimestamp, config);
      assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
    });

    it('returns tx gas price if current network price lower than tx gas price', async () => {
      const gasPrice = await getExecutionGasPrice(txTimestamp, config);
      assert.equal(gasPrice.toNumber(), txTimestamp.gasPrice.toNumber());
    });

    it('returns current network price if (tx gas price + subsidy) higher than current network price', async () => {
      txTimestamp.gasPrice = new BigNumber(config.web3.toWei(19, 'gwei'));
      config.economicStrategy.maxGasSubsidy = 100;
      const currentNetworkPrice = await config.util.networkGasPrice();
      const gasPrice = await getExecutionGasPrice(txTimestamp, config);
      assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
    });

    it('returns (tx gas price + subsidy) if (tx gas price + subsidy) lower than current network price', async () => {
      txTimestamp.gasPrice = new BigNumber(config.web3.toWei(19, 'gwei'));
      config.economicStrategy.maxGasSubsidy = 1;

      const expectedResult = txTimestamp.gasPrice.plus(
        txTimestamp.gasPrice.times(config.economicStrategy.maxGasSubsidy / 100)
      );

      const gasPrice = await getExecutionGasPrice(txTimestamp, config);
      assert.equal(gasPrice.toNumber(), expectedResult.toNumber());
    });
  });
});
