import BigNumber from 'bignumber.js';
import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { Config } from '../../src';
import Cache, { ICachedTxDetails } from '../../src/Cache';
import { EconomicStrategyManager } from '../../src/EconomicStrategy/EconomicStrategyManager';
import { EconomicStrategyStatus } from '../../src/Enum';
import { ITransactionRequest } from '@ethereum-alarm-clock/lib/built/transactionRequest/ITransactionRequest';
import { GasPriceUtil, Util } from '@ethereum-alarm-clock/lib';
import { GasPriceEstimation } from '@ethereum-alarm-clock/lib/built/utils/GasPriceUtil';

// tslint:disable-next-line:no-big-function
describe('Economic Strategy Tests', () => {
  const MWei = new BigNumber(1000000);

  const account = '0x123456';
  const defaultBalance = MWei;
  const defaultBounty = MWei.times(1000);
  const defaultGasPrice = new BigNumber(1000);
  const CLAIMING_GAS_ESTIMATE = 100000;

  const defaultClaimingCost = defaultGasPrice.mul(CLAIMING_GAS_ESTIMATE);
  const defaultPaymentModifier = new BigNumber(10); //10%
  const defaultZeroProfitabilityBounty = defaultClaimingCost.times(100).div(defaultPaymentModifier);

  const createTxRequest = (
    gasPrice = defaultGasPrice,
    bounty = defaultBounty,
    claimedBy = account,
    paymentModifier = defaultPaymentModifier,
    temporalUnit = 1,
    reservedWindowSize = new BigNumber(3600),
    claimWindowEnd = new BigNumber(123155)
  ) => {
    const txRequest = TypeMoq.Mock.ofType<ITransactionRequest>();
    txRequest.setup(tx => tx.gasPrice).returns(() => gasPrice);
    txRequest.setup(tx => tx.now()).returns(() => Promise.resolve(new BigNumber(123123)));
    txRequest.setup(tx => tx.reservedWindowEnd).returns(() => new BigNumber(23423));
    txRequest.setup(tx => tx.reservedWindowSize).returns(() => reservedWindowSize);
    txRequest.setup(tx => tx.executionWindowEnd).returns(() => new BigNumber(23423));
    txRequest.setup(tx => tx.bounty).returns(() => bounty);
    txRequest.setup(tx => tx.requiredDeposit).returns(() => MWei);
    txRequest.setup(tx => tx.claimPaymentModifier()).returns(async () => paymentModifier);
    txRequest.setup(tx => tx.claimedBy).returns(() => claimedBy);
    txRequest.setup(tx => tx.address).returns(() => '0x987654321');
    txRequest.setup(tx => tx.temporalUnit).returns(() => temporalUnit);
    txRequest.setup(tx => tx.claimWindowEnd).returns(() => claimWindowEnd);

    return txRequest;
  };

  const createGasPriceUtil = (gasPrice = defaultGasPrice) => {
    const gasPriceUtil = TypeMoq.Mock.ofType<GasPriceUtil>();
    gasPriceUtil.setup(u => u.networkGasPrice()).returns(() => Promise.resolve(gasPrice));
    gasPriceUtil.setup(u => u.getGasPrice()).returns(() => Promise.resolve(gasPrice));
    gasPriceUtil
      .setup(u => u.getAdvancedNetworkGasPrice())
      .returns(() =>
        Promise.resolve({
          safeLow: gasPrice,
          average: gasPrice,
          fast: gasPrice,
          fastest: gasPrice
        } as GasPriceEstimation)
      );

    return gasPriceUtil.object;
  };

  const createUtil = () => {
    const util = TypeMoq.Mock.ofType<Util>();

    util.setup(u => u.balanceOf(TypeMoq.It.isAny())).returns(() => Promise.resolve(defaultBalance));
    util.setup(u => u.calculateGasAmount(TypeMoq.It.isAny())).returns(() => MWei);

    return util.object;
  };

  const defaultUtil = createUtil();
  const defaultGasPriceUtil = createGasPriceUtil();

  const cache = TypeMoq.Mock.ofType<Cache<ICachedTxDetails>>();
  cache.setup(c => c.stored()).returns(() => []);

  const shouldClaimTx = async (
    minProfitability: BigNumber,
    bounty: BigNumber
  ): Promise<EconomicStrategyStatus> => {
    const strategy = Object.assign({}, Config.DEFAULT_ECONOMIC_STRATEGY, { minProfitability });
    const economicStrategyManager = new EconomicStrategyManager(
      strategy,
      defaultGasPriceUtil,
      cache.object,
      null,
      defaultUtil
    );
    const txRequest = createTxRequest(defaultGasPrice, bounty);
    const gasPrice = await defaultGasPriceUtil.getAdvancedNetworkGasPrice();
    return economicStrategyManager.shouldClaimTx(txRequest.object, account, gasPrice.average);
  };

  describe('shouldClaimTx()', () => {
    it('returns CLAIM when using default strategy', async () => {
      const strategy = Config.DEFAULT_ECONOMIC_STRATEGY;
      const economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultGasPriceUtil,
        cache.object,
        null,
      defaultUtil
      );
      const txRequest = createTxRequest();
      const gasPrice = await defaultGasPriceUtil.getAdvancedNetworkGasPrice();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.CLAIM);
    });

    it('returns INSUFFICIENT_BALANCE if balance below minBalance', async () => {
      const strategy = Object.assign({}, Config.DEFAULT_ECONOMIC_STRATEGY, {
        minBalance: defaultBalance.plus(1)
      });
      const economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultGasPriceUtil,
        cache.object,
        null,
      defaultUtil
      );
      const txRequest = createTxRequest();
      const gasPrice = await defaultGasPriceUtil.getAdvancedNetworkGasPrice();
      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.INSUFFICIENT_BALANCE);
    });

    it('returns NOT_PROFITABLE if reward lower than minProfitability', async () => {
      const expectedProfitability = new BigNumber(1000);
      const bounty = defaultZeroProfitabilityBounty.plus(
        expectedProfitability.times(defaultPaymentModifier)
      );
      const minProfitability = expectedProfitability.plus(1);

      const shouldClaimStatus = await shouldClaimTx(minProfitability, bounty);

      assert.equal(shouldClaimStatus, EconomicStrategyStatus.NOT_PROFITABLE);
    });

    it('returns CLAIM if reward equals minProfitability', async () => {
      const expectedProfitability = new BigNumber(1000);
      const bounty = defaultZeroProfitabilityBounty.plus(
        expectedProfitability.times(defaultPaymentModifier)
      );
      const minProfitability = expectedProfitability;

      const shouldClaimStatus = await shouldClaimTx(minProfitability, bounty);

      assert.equal(shouldClaimStatus, EconomicStrategyStatus.CLAIM);
    });

    it('returns CLAIM if reward greater than minProfitability', async () => {
      const expectedProfitability = new BigNumber(1000);
      const bounty = defaultZeroProfitabilityBounty.plus(
        expectedProfitability.times(defaultPaymentModifier)
      );
      const minProfitability = expectedProfitability.minus(1);

      const shouldClaimStatus = await shouldClaimTx(minProfitability, bounty);

      assert.equal(shouldClaimStatus, EconomicStrategyStatus.CLAIM);
    });

    it('returns TOO_SHORT_RESERVED if reserved window in timestamp is too short', async () => {
      const strategy = Object.assign({}, Config.DEFAULT_ECONOMIC_STRATEGY, {
        minExecutionWindow: 600
      });
      const economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultGasPriceUtil,
        cache.object,
        null,
        defaultUtil
      );

      const txRequest = createTxRequest(
        defaultGasPrice,
        defaultBounty,
        account,
        defaultPaymentModifier,
        2,
        new BigNumber(100)
      );
      const gasPrice = await defaultGasPriceUtil.getAdvancedNetworkGasPrice();

      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.TOO_SHORT_RESERVED);
    });

    it('returns TOO_SHORT_RESERVED if reserved window in block is too short', async () => {
      const strategy = Object.assign({}, Config.DEFAULT_ECONOMIC_STRATEGY, {
        minExecutionWindowBlock: 600
      });
      const economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultGasPriceUtil,
        cache.object,
        null,
        defaultUtil
      );

      const txRequest = createTxRequest(
        defaultGasPrice,
        defaultBounty,
        account,
        defaultPaymentModifier,
        1,
        new BigNumber(100)
      );
      const gasPrice = await defaultGasPriceUtil.getAdvancedNetworkGasPrice();

      const shouldClaimStatus = await economicStrategyManager.shouldClaimTx(
        txRequest.object,
        account,
        gasPrice.average
      );
      assert.equal(shouldClaimStatus, EconomicStrategyStatus.TOO_SHORT_RESERVED);
    });
  });

  describe('getExecutionGasPrice()', () => {
    it('returns current network price if maxGasSubsidy not set', async () => {
      const currentNetworkPrice = await defaultGasPriceUtil.networkGasPrice();
      const economicStrategyManager = new EconomicStrategyManager(
        Config.DEFAULT_ECONOMIC_STRATEGY,
        defaultGasPriceUtil,
        cache.object,
        null,
      defaultUtil
      );
      const gasPrice = await economicStrategyManager.getExecutionGasPrice(createTxRequest().object);

      assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
    });

    it('returns tx gas price if current network price lower than tx gas price', async () => {
      const economicStrategyManager = new EconomicStrategyManager(
        Config.DEFAULT_ECONOMIC_STRATEGY,
        defaultGasPriceUtil,
        cache.object,
        null,
        defaultUtil
      );
      const txRequest = createTxRequest().object;
      const gasPrice = await economicStrategyManager.getExecutionGasPrice(txRequest);

      assert.equal(gasPrice.toNumber(), txRequest.gasPrice.toNumber());
    });

    it('returns current network price if (tx gas price + subsidy) higher than current network price', async () => {
      const lowerGasPrice = defaultGasPrice.minus(100);
      const txRequest = createTxRequest(lowerGasPrice);
      const currentNetworkPrice = await defaultGasPriceUtil.networkGasPrice();

      const economicStrategyManager = new EconomicStrategyManager(
        Config.DEFAULT_ECONOMIC_STRATEGY,
        defaultGasPriceUtil,
        cache.object,
        null,
      defaultUtil,
      );
      const gasPrice = await economicStrategyManager.getExecutionGasPrice(txRequest.object);

      assert.equal(gasPrice.toNumber(), currentNetworkPrice.toNumber());
    });

    it('returns (tx gas price + subsidy) if (tx gas price + subsidy) lower than current network price', async () => {
      const strategy = Object.assign({}, Config.DEFAULT_ECONOMIC_STRATEGY, {
        maxSubsidy: 1
      });

      const lowerGasPrice = defaultGasPrice.div(2);
      const txRequest = createTxRequest(lowerGasPrice).object;

      const expectedResult = txRequest.gasPrice.plus(
        txRequest.gasPrice.times(strategy.maxGasSubsidy / 100)
      );
      const economicStrategyManager = new EconomicStrategyManager(
        strategy,
        defaultGasPriceUtil,
        cache.object,
        null,
        defaultUtil
              );

      const gasPrice = await economicStrategyManager.getExecutionGasPrice(txRequest);

      assert.equal(gasPrice.toNumber(), expectedResult.toNumber());
    });
  });

  describe('shouldExecuteTx()', () => {
    it('returns true if CurrentGasCost < (Deposit + Reward + Reimbursement)', async () => {
      const txRequest = createTxRequest();

      const economicStrategyManager = new EconomicStrategyManager(
        Config.DEFAULT_ECONOMIC_STRATEGY,
        defaultGasPriceUtil,
        cache.object,
        null,
      defaultUtil
      );
      const gasPrice = await defaultGasPriceUtil.getAdvancedNetworkGasPrice();
      const shouldExecute = await economicStrategyManager.shouldExecuteTx(
        txRequest.object,
        gasPrice.average
      );
      assert.isTrue(shouldExecute);
    });

    it('returns false if CurrentGasCost > (Deposit + Reward + Reimbursement)', async () => {
      const txRequest = createTxRequest();
      const gasPriceUtil = createGasPriceUtil(defaultGasPrice.times(1000));

      const economicStrategyManager = new EconomicStrategyManager(
        Config.DEFAULT_ECONOMIC_STRATEGY,
        gasPriceUtil,
        cache.object,
        null,
      defaultUtil
      );
      const gasPrice = await gasPriceUtil.getAdvancedNetworkGasPrice();
      const shouldExecute = await economicStrategyManager.shouldExecuteTx(
        txRequest.object,
        gasPrice.average
      );

      assert.isFalse(shouldExecute);
    });

    it('returns true if CurrentGasCost < (Reward + Reimbursement) and not claimed by me', async () => {
      const txRequest = createTxRequest(defaultGasPrice, defaultBounty, '0x1');

      const economicStrategyManager = new EconomicStrategyManager(
        Config.DEFAULT_ECONOMIC_STRATEGY,
        defaultGasPriceUtil,
        cache.object,
        null,
      defaultUtil,
      );

      const gasPrice = await defaultGasPriceUtil.getAdvancedNetworkGasPrice();
      const shouldExecute = await economicStrategyManager.shouldExecuteTx(
        txRequest.object,
        gasPrice.average
      );
      assert.isTrue(shouldExecute);
    });
  });
});
