import BigNumber from 'bignumber.js';
import { assert } from 'chai';
import { Config } from '../../src/index';
import { mockConfig, mockTxRequest } from '../helpers';
import { shouldClaimTx, getExecutionGasPrice, shouldExecuteTx } from '../../src/EconomicStrategy';
import { EconomicStrategyStatus } from '../../src/Enum';

describe('Economic Strategy Tests', () => {
  let config: Config;
  let txTimestamp: any;

  const reset = async () => {
    config = await mockConfig();
    txTimestamp = await mockTxRequest(config.web3);
  };

  beforeEach(reset);

  describe('shouldClaimTx()', () => {
    it('returns CLAIM if economic strategy is default', async () => {
      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await shouldClaimTx(txTimestamp, config, nextAccount);
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.CLAIM);
    });

    it('returns CLAIM if economic strategy not set', async () => {
      config.economicStrategy = null;
      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await shouldClaimTx(txTimestamp, config, nextAccount);
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.CLAIM);
    });

    it('returns DEPOSIT_TOO_HIGH if transaction exceeds maxDeposit', async () => {
      config.economicStrategy.maxDeposit = new BigNumber(1);
      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await shouldClaimTx(txTimestamp, config, nextAccount);
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.DEPOSIT_TOO_HIGH);
    });

    it('returns INSUFFICIENT_BALANCE if balance below minBalance', async () => {
      config.economicStrategy.minBalance = new BigNumber(config.web3.toWei(101, 'ether'));
      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await shouldClaimTx(txTimestamp, config, nextAccount);
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.INSUFFICIENT_BALANCE);
    });

    it('returns NOT_PROFITABLE if reward lower than minProfitability', async () => {
      config.economicStrategy.minProfitability = new BigNumber(config.web3.toWei(100, 'ether'));
      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await shouldClaimTx(txTimestamp, config, nextAccount);
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.NOT_PROFITABLE);
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
      config.economicStrategy.maxGasSubsidy = 100;
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

  describe('shouldExecuteTx()', () => {
    it('returns true if CurrentGasCost < (Deposit + Reward + Reimbursement)', async () => {
      txTimestamp.claimedBy = config.wallet.getAddresses()[0];
      const shouldExecute = await shouldExecuteTx(txTimestamp, config);
      assert.isTrue(shouldExecute);
    });

    it('returns false if CurrentGasCost > (Deposit + Reward + Reimbursement)', async () => {
      txTimestamp.claimedBy = config.wallet.getAddresses()[0];
      txTimestamp.requiredDeposit = new BigNumber(config.web3.toWei(0, 'ether'));
      txTimestamp.bounty = new BigNumber(config.web3.toWei(0.1, 'gwei'));
      config.util.networkGasPrice = () =>
        Promise.resolve(new BigNumber(config.web3.toWei(100, 'gwei')));

      const shouldExecute = await shouldExecuteTx(txTimestamp, config);
      assert.isFalse(shouldExecute);
    });

    it('returns true if CurrentGasCost < (Reward + Reimbursement) and not claimed by me', async () => {
      const shouldExecute = await shouldExecuteTx(txTimestamp, config);
      assert.isTrue(shouldExecute);
    });
  });
});
