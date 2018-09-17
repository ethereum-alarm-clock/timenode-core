import * as TypeMoq from 'typemoq';
import BigNumber from 'bignumber.js';
import { assert } from 'chai';
import { Config, W3Util } from '../../src/index';
import { mockConfig, mockTxRequest } from '../helpers';
import { EconomicStrategyStatus } from '../../src/Enum';
import {
  IEconomicStrategyManager,
  EconomicStrategyManager
} from '../../src/EconomicStrategy/EconomicStrategyManager';
import { IEconomicStrategy } from '../../src/EconomicStrategy';

describe('Economic Strategy Tests', () => {
  let config: Config;
  let txTimestamp: any;
  let economicStrategyManager: IEconomicStrategyManager;

  const util = TypeMoq.Mock.ofType<W3Util>();

  const reset = async () => {
    config = await mockConfig();
    txTimestamp = await mockTxRequest(config.web3);
  };

  beforeEach(reset);

  describe('shouldClaimTx()', () => {
    it('returns CLAIM if economic strategy is default', async () => {
      economicStrategyManager = new EconomicStrategyManager(null, util.object, null, null);

      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txTimestamp,
        nextAccount
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.CLAIM);
    });

    it('returns CLAIM if economic strategy not set', async () => {
      economicStrategyManager = new EconomicStrategyManager(null, util.object, null, null);

      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txTimestamp,
        nextAccount
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.CLAIM);
    });

    it('returns DEPOSIT_TOO_HIGH if transaction exceeds maxDeposit', async () => {
      const strategy: IEconomicStrategy = {
        maxDeposit: new BigNumber(1)
      };

      economicStrategyManager = new EconomicStrategyManager(strategy, util.object, null, null);

      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txTimestamp,
        nextAccount
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.DEPOSIT_TOO_HIGH);
    });

    it('returns INSUFFICIENT_BALANCE if balance below minBalance', async () => {
      const strategy: IEconomicStrategy = {
        minBalance: new BigNumber(config.web3.toWei(101, 'ether'))
      };

      economicStrategyManager = new EconomicStrategyManager(strategy, util.object, null, null);

      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txTimestamp,
        nextAccount
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.INSUFFICIENT_BALANCE);
    });

    it('returns NOT_PROFITABLE if reward lower than minProfitability', async () => {
      const strategy: IEconomicStrategy = {
        minProfitability: new BigNumber(config.web3.toWei(100, 'ether'))
      };

      economicStrategyManager = new EconomicStrategyManager(strategy, util.object, null, null);

      const nextAccount = config.wallet.nextAccount.getAddressString();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txTimestamp,
        nextAccount
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.NOT_PROFITABLE);
    });
  });

  // describe('getExecutionGasPrice()', () => {
  //   it('returns current network price if economic strategy not set', async () => {
  //     config.economicStrategy = null;
  //     const currentNetworkPrice = await config.util.networkGasPrice();
  //     const gasPrice = await getExecutionGasPrice(txTimestamp, config);
  //     assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
  //   });

  //   it('returns current network price if maxGasSubsidy not set', async () => {
  //     config.economicStrategy.maxGasSubsidy = null;
  //     const currentNetworkPrice = await config.util.networkGasPrice();
  //     const gasPrice = await getExecutionGasPrice(txTimestamp, config);
  //     assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
  //   });

  //   it('returns tx gas price if current network price lower than tx gas price', async () => {
  //     config.economicStrategy.maxGasSubsidy = 100;
  //     const gasPrice = await getExecutionGasPrice(txTimestamp, config);
  //     assert.equal(gasPrice.toNumber(), txTimestamp.gasPrice.toNumber());
  //   });

  //   it('returns current network price if (tx gas price + subsidy) higher than current network price', async () => {
  //     txTimestamp.gasPrice = new BigNumber(config.web3.toWei(19, 'gwei'));
  //     config.economicStrategy.maxGasSubsidy = 100;
  //     const currentNetworkPrice = await config.util.networkGasPrice();
  //     const gasPrice = await getExecutionGasPrice(txTimestamp, config);
  //     assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
  //   });

  //   it('returns (tx gas price + subsidy) if (tx gas price + subsidy) lower than current network price', async () => {
  //     txTimestamp.gasPrice = new BigNumber(config.web3.toWei(19, 'gwei'));
  //     config.economicStrategy.maxGasSubsidy = 1;

  //     const expectedResult = txTimestamp.gasPrice.plus(
  //       txTimestamp.gasPrice.times(config.economicStrategy.maxGasSubsidy / 100)
  //     );

  //     const gasPrice = await getExecutionGasPrice(txTimestamp, config);
  //     assert.equal(gasPrice.toNumber(), expectedResult.toNumber());
  //   });
  // });

  // describe('shouldExecuteTx()', () => {
  //   it('returns true if CurrentGasCost < (Deposit + Reward + Reimbursement)', async () => {
  //     txTimestamp.claimedBy = config.wallet.getAddresses()[0];
  //     const shouldExecute = await shouldExecuteTx(txTimestamp, config);
  //     assert.isTrue(shouldExecute);
  //   });

  //   it('returns false if CurrentGasCost > (Deposit + Reward + Reimbursement)', async () => {
  //     txTimestamp.claimedBy = config.wallet.getAddresses()[0];
  //     txTimestamp.requiredDeposit = new BigNumber(config.web3.toWei(0, 'ether'));
  //     txTimestamp.bounty = new BigNumber(config.web3.toWei(0.1, 'gwei'));
  //     config.util.networkGasPrice = () =>
  //       Promise.resolve(new BigNumber(config.web3.toWei(100, 'gwei')));

  //     const shouldExecute = await shouldExecuteTx(txTimestamp, config);
  //     assert.isFalse(shouldExecute);
  //   });

  //   it('returns true if CurrentGasCost < (Reward + Reimbursement) and not claimed by me', async () => {
  //     const shouldExecute = await shouldExecuteTx(txTimestamp, config);
  //     assert.isTrue(shouldExecute);
  //   });
  // });
});
