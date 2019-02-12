import {
  GasPriceEstimation,
  Util,
  ITransactionRequest,
  GasPriceUtil
} from '@ethereum-alarm-clock/lib';
import BigNumber from 'bignumber.js';
import * as TypeMoq from 'typemoq';

import { ProfitabilityCalculator } from '../../src/EconomicStrategy/ProfitabilityCalculator';
import { assert } from 'chai';

// tslint:disable-next-line:no-big-function
describe('Profitability Calculator Tests', () => {
  const MWei = new BigNumber(1000000);
  const GWei = MWei.times(1000);
  const Szabo = GWei.times(1000);
  const Finney = Szabo.times(1000);

  const account = '0x123456';
  const defaultBounty = Finney.times(20);
  const defaultGasPrice = GWei;
  const defaultPaymentModifier = new BigNumber(10); //10%
  const defaultCallGas = new BigNumber(21000);
  const CLAIMING_GAS_ESTIMATE = 100000;

  const util = new Util(null);

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
    txRequest.setup(tx => tx.callGas).returns(() => defaultCallGas);
    txRequest.setup(tx => tx.isClaimed).returns(() => true);

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

  const calculateExpectedRewardWhenClaiming = (
    txRequest: ITransactionRequest,
    paymentModifier: BigNumber | number,
    claimingGasCost: BigNumber | number,
    executionSubsidy: BigNumber | number
  ) =>
    txRequest.bounty
      .times(paymentModifier)
      .minus(claimingGasCost)
      .minus(executionSubsidy)
      .decimalPlaces(0);

  const calculateExpectedRewardWhenExecuting = (
    txRequest: ITransactionRequest,
    paymentModifier: BigNumber | number,
    executionSubsidy: BigNumber | number
  ) =>
    txRequest.bounty
      .times(paymentModifier)
      .minus(executionSubsidy)
      .plus(txRequest.isClaimed ? txRequest.requiredDeposit : 0)
      .decimalPlaces(0);

  const zeroProfitabilityExecutionGasPrice = (
    txRequest: ITransactionRequest,
    paymentModifier: BigNumber | number,
    executionGasAmount: BigNumber
  ) =>
    txRequest.bounty
      .times(paymentModifier)
      .plus(txRequest.isClaimed ? txRequest.requiredDeposit : 0)
      .dividedBy(executionGasAmount)
      .plus(txRequest.gasPrice);

  describe('claiming profitability', () => {
    it('calculates profitability with default values', async () => {
      const strategy = new ProfitabilityCalculator(util, createGasPriceUtil());

      const paymentModifier = defaultPaymentModifier.div(100);
      const claimingGasCost = defaultGasPrice.times(CLAIMING_GAS_ESTIMATE);
      const executionSubsidy = 0;

      const txRequest = createTxRequest().object;
      const expectedReward = calculateExpectedRewardWhenClaiming(
        txRequest,
        paymentModifier,
        claimingGasCost,
        executionSubsidy
      );

      const result = await strategy.claimingProfitability(txRequest, defaultGasPrice);

      assert.isTrue(expectedReward.isEqualTo(result));
      assert.isTrue(result.isGreaterThan(0));
    });

    it('calculates profitability with 0 minimum execution gas price', async () => {
      const strategy = new ProfitabilityCalculator(util, createGasPriceUtil());
      const paymentModifier = defaultPaymentModifier.div(100);
      const claimingGasCost = defaultGasPrice.times(CLAIMING_GAS_ESTIMATE);

      const transactionExecutionGasPrice = new BigNumber(0);
      const txRequest = createTxRequest(transactionExecutionGasPrice).object;

      const executionSubsidy = util.calculateGasAmount(txRequest).times(defaultGasPrice); // this means that max gas Price is 2x
      const expectedReward = calculateExpectedRewardWhenClaiming(
        txRequest,
        paymentModifier,
        claimingGasCost,
        executionSubsidy
      );

      const result = await strategy.claimingProfitability(txRequest, defaultGasPrice);

      assert.isTrue(expectedReward.isEqualTo(result));
      assert.isTrue(result.isGreaterThan(0));
    });
  });

  describe('execution profitability', () => {
    it('calculates profitability with default values', async () => {
      const strategy = new ProfitabilityCalculator(util, createGasPriceUtil());

      const paymentModifier = defaultPaymentModifier.div(100);
      const executionSubsidy = 0;

      const txRequest = createTxRequest().object;
      const expectedReward = calculateExpectedRewardWhenExecuting(
        txRequest,
        paymentModifier,
        executionSubsidy
      );

      const result = await strategy.executionProfitability(txRequest, defaultGasPrice);

      assert.isTrue(expectedReward.isEqualTo(result));
      assert.isTrue(result.isGreaterThan(0));
    });

    it('returns 0 profitability when network gas price at zero profitability', async () => {
      const strategy = new ProfitabilityCalculator(util, createGasPriceUtil());
      const txRequest = createTxRequest().object;

      const paymentModifier = defaultPaymentModifier.dividedBy(100);
      const executionGasAmount = util.calculateGasAmount(txRequest);

      const maximumGasPrice = zeroProfitabilityExecutionGasPrice(
        txRequest,
        paymentModifier,
        executionGasAmount
      );
      const executionSubsidy = maximumGasPrice.minus(txRequest.gasPrice).times(executionGasAmount);

      const expectedReward = calculateExpectedRewardWhenExecuting(
        txRequest,
        paymentModifier,
        executionSubsidy
      );

      const result = await strategy.executionProfitability(txRequest, maximumGasPrice);

      assert.isTrue(expectedReward.isEqualTo(result));
      assert.isTrue(result.isZero());
    });

    it('returns negative profitability when network gas price above zero profitability', async () => {
      const strategy = new ProfitabilityCalculator(util, createGasPriceUtil());
      const txRequest = createTxRequest().object;

      const paymentModifier = defaultPaymentModifier.div(100);
      const executionGasAmount = util.calculateGasAmount(txRequest);

      const maximumGasPrice = zeroProfitabilityExecutionGasPrice(
        txRequest,
        paymentModifier,
        executionGasAmount
      );
      const negativeRewardGasPrice = maximumGasPrice.plus(1);

      const executionSubsidy = negativeRewardGasPrice
        .minus(txRequest.gasPrice)
        .times(executionGasAmount);

      const expectedReward = calculateExpectedRewardWhenExecuting(
        txRequest,
        paymentModifier,
        executionSubsidy
      );

      const result = await strategy.executionProfitability(txRequest, negativeRewardGasPrice);

      assert.isTrue(expectedReward.isEqualTo(result));
      assert.isTrue(result.isNegative());
    });
  });
});
