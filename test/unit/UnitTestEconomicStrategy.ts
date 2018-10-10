import BigNumber from 'bignumber.js';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';

import { W3Util } from '../../src';
import Cache, { ICachedTxDetails } from '../../src/Cache';
import { IEconomicStrategy } from '../../src/EconomicStrategy';
import {
  EconomicStrategyManager,
  IEconomicStrategyManager
} from '../../src/EconomicStrategy/EconomicStrategyManager';
import { EconomicStrategyStatus } from '../../src/Enum';
import { ITxRequest, GasPriceEstimation } from '../../src/Types';

// tslint:disable-next-line:no-big-function
describe('Economic Strategy Tests', () => {
  let economicStrategyManager: IEconomicStrategyManager;
  const MWei = new BigNumber(10000000);

  const account = '0x123456';
  const defaultBalance = MWei;
  const defaultBounty = MWei;
  const defaultGasPrice = MWei;

  const createTxRequest = (
    gasPrice = defaultGasPrice,
    bounty = defaultBounty,
    claimedBy = account
  ) => {
    const txRequest = TypeMoq.Mock.ofType<ITxRequest>();
    txRequest.setup(tx => tx.gasPrice).returns(() => gasPrice);
    txRequest.setup(tx => tx.now()).returns(() => Promise.resolve(new BigNumber(123123)));
    txRequest.setup(tx => tx.reservedWindowEnd).returns(() => new BigNumber(23423));
    txRequest.setup(tx => tx.executionWindowEnd).returns(() => new BigNumber(23423));
    txRequest.setup(tx => tx.bounty).returns(() => bounty);
    txRequest.setup(tx => tx.requiredDeposit).returns(() => MWei);
    txRequest
      .setup(tx => tx.claimPaymentModifier())
      .returns(() => Promise.resolve(new BigNumber(1)));
    txRequest.setup(tx => tx.claimedBy).returns(() => claimedBy);
    txRequest.setup(tx => tx.address).returns(() => '0x987654321');

    return txRequest;
  };

  const createUtil = (gasPrice = defaultGasPrice) => {
    const util = TypeMoq.Mock.ofType<W3Util>();
    util.setup(u => u.networkGasPrice()).returns(() => Promise.resolve(gasPrice));
    util.setup(u => u.getGasPrice()).returns(() => Promise.resolve(gasPrice));
    util.setup(u => u.getAdvancedNetworkGasPrice()).returns(() =>
      Promise.resolve({
        safeLow: gasPrice,
        average: gasPrice,
        fast: gasPrice,
        fastest: gasPrice
      } as GasPriceEstimation)
    );
    util.setup(u => u.balanceOf(TypeMoq.It.isAny())).returns(() => Promise.resolve(defaultBalance));
    util.setup(u => u.calculateGasAmount(TypeMoq.It.isAny())).returns(() => MWei);

    return util.object;
  };

  const defaultUtil = createUtil();

  const cache = TypeMoq.Mock.ofType<Cache<ICachedTxDetails>>();
  cache.setup(c => c.stored()).returns(() => []);

  describe('shouldClaimTx()', () => {
    it('returns CLAIM if economic strategy not set or default', async () => {
      economicStrategyManager = new EconomicStrategyManager(null, defaultUtil, cache.object, null);
      const txRequest = createTxRequest();
      const gasPrice = await defaultUtil.getAdvancedNetworkGasPrice();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.CLAIM);
    });

    it('returns DEPOSIT_TOO_HIGH if transaction exceeds maxDeposit', async () => {
      const strategy: IEconomicStrategy = {
        maxDeposit: new BigNumber(1)
      };

      economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultUtil,
        cache.object,
        null
      );
      const txRequest = createTxRequest();
      const gasPrice = await defaultUtil.getAdvancedNetworkGasPrice();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.DEPOSIT_TOO_HIGH);
    });

    it('returns INSUFFICIENT_BALANCE if balance below minBalance', async () => {
      const strategy: IEconomicStrategy = {
        minBalance: defaultBalance.plus(1)
      };

      economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultUtil,
        cache.object,
        null
      );
      const txRequest = createTxRequest();
      const gasPrice = await defaultUtil.getAdvancedNetworkGasPrice();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.INSUFFICIENT_BALANCE);
    });

    it('returns NOT_PROFITABLE if reward lower than minProfitability', async () => {
      const strategy: IEconomicStrategy = {
        minProfitability: defaultBounty.times(10)
      };

      economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultUtil,
        cache.object,
        null
      );
      const txRequest = createTxRequest();
      const gasPrice = await defaultUtil.getAdvancedNetworkGasPrice();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.NOT_PROFITABLE);
    });

    it('returns WINDOW_TOO_SHORT if reserved window in timestamp is too short', async () => {
      const strategy: IEconomicStrategy = {
        minExecutionWindow: 600
      };

      economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultUtil,
        cache.object,
        null
      );

      const txRequest = createTxRequest();
      txRequest.setup(t => t.temporalUnit).returns(() => 2);
      txRequest.setup(t => t.reservedWindowSize).returns(() => new BigNumber(100));

      const gasPrice = await defaultUtil.getAdvancedNetworkGasPrice();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.WINDOW_TOO_SHORT);
    });

    it('returns WINDOW_TOO_SHORT if reserved window in block is too short', async () => {
      const strategy: IEconomicStrategy = {
        minExecutionWindowBlock: 600
      };

      economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultUtil,
        cache.object,
        null
      );

      const txRequest = createTxRequest();
      txRequest.setup(t => t.temporalUnit).returns(() => 1);
      txRequest.setup(t => t.reservedWindowSize).returns(() => new BigNumber(100));
      const gasPrice = await defaultUtil.getAdvancedNetworkGasPrice();

      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.WINDOW_TOO_SHORT);
    });
  });

  describe('getExecutionGasPrice()', () => {
    it('returns current network price if economic strategy not set', async () => {
      const currentNetworkPrice = await defaultUtil.networkGasPrice();

      economicStrategyManager = new EconomicStrategyManager(null, defaultUtil, cache.object, null);
      const gasPrice = await economicStrategyManager.getExecutionGasPrice(createTxRequest().object);
      assert.equal(
        gasPrice.toNumber(),
        currentNetworkPrice.toNumber(),
        'Execution gas price is not equal to current network price!'
      );
    });

    it('returns current network price if maxGasSubsidy not set', async () => {
      const strategy: IEconomicStrategy = {
        maxGasSubsidy: null
      };
      const currentNetworkPrice = await defaultUtil.networkGasPrice();

      economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultUtil,
        cache.object,
        null
      );
      const gasPrice = await economicStrategyManager.getExecutionGasPrice(createTxRequest().object);

      assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
    });

    it('returns tx gas price if current network price lower than tx gas price', async () => {
      const strategy: IEconomicStrategy = {
        maxGasSubsidy: 100
      };
      economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultUtil,
        cache.object,
        null
      );
      const txRequest = createTxRequest().object;
      const gasPrice = await economicStrategyManager.getExecutionGasPrice(txRequest);

      assert.equal(gasPrice.toNumber(), txRequest.gasPrice.toNumber());
    });

    it('returns current network price if (tx gas price + subsidy) higher than current network price', async () => {
      const strategy: IEconomicStrategy = {
        maxGasSubsidy: 100
      };
      const lowerGasPrice = defaultGasPrice.minus(100);
      const txRequest = createTxRequest(lowerGasPrice);
      const currentNetworkPrice = await defaultUtil.networkGasPrice();

      economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultUtil,
        cache.object,
        null
      );
      const gasPrice = await economicStrategyManager.getExecutionGasPrice(txRequest.object);

      assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
    });

    it('returns (tx gas price + subsidy) if (tx gas price + subsidy) lower than current network price', async () => {
      const strategy: IEconomicStrategy = {
        maxGasSubsidy: 1
      };

      const lowerGasPrice = defaultGasPrice.div(2);
      const txRequest = createTxRequest(lowerGasPrice).object;

      const expectedResult = txRequest.gasPrice.plus(
        txRequest.gasPrice.times(strategy.maxGasSubsidy / 100)
      );
      economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultUtil,
        cache.object,
        null
      );

      const gasPrice = await economicStrategyManager.getExecutionGasPrice(txRequest);

      assert.equal(gasPrice.toNumber(), expectedResult.toNumber());
    });
  });

  describe('shouldExecuteTx()', () => {
    it('returns true if CurrentGasCost < (Deposit + Reward + Reimbursement)', async () => {
      const txRequest = createTxRequest();

      economicStrategyManager = new EconomicStrategyManager(null, defaultUtil, cache.object, null);
      const gasPrice = await defaultUtil.getAdvancedNetworkGasPrice();
      const shouldExecute = await economicStrategyManager.shouldExecuteTx(
        txRequest.object,
        gasPrice.average
      );
      assert.isTrue(shouldExecute);
    });

    it('returns false if CurrentGasCost > (Deposit + Reward + Reimbursement)', async () => {
      const txRequest = createTxRequest();
      const util = createUtil(defaultGasPrice.times(1000));

      economicStrategyManager = new EconomicStrategyManager(null, util, cache.object, null);
      const gasPrice = await util.getAdvancedNetworkGasPrice();
      const shouldExecute = await economicStrategyManager.shouldExecuteTx(
        txRequest.object,
        gasPrice.average
      );

      assert.isFalse(shouldExecute);
    });

    it('returns true if CurrentGasCost < (Reward + Reimbursement) and not claimed by me', async () => {
      const txRequest = createTxRequest(defaultGasPrice, defaultBounty, '0x1');

      economicStrategyManager = new EconomicStrategyManager(null, defaultUtil, cache.object, null);

      const gasPrice = await defaultUtil.getAdvancedNetworkGasPrice();
      const shouldExecute = await economicStrategyManager.shouldExecuteTx(
        txRequest.object,
        gasPrice.average
      );
      assert.isTrue(shouldExecute);
    });
  });
});
