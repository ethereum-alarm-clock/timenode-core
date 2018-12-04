import { BigNumber } from 'bignumber.js';
import Cache, { ICachedTxDetails } from '../Cache';
import { EconomicStrategyStatus } from '../Enum';
import { ILogger, DefaultLogger } from '../Logger';
import { Address } from '../Types';
import { IEconomicStrategy } from './IEconomicStrategy';
import { NormalizedTimes } from './NormalizedTimes';
import { EAC, Util, GasPriceUtil } from '@ethereum-alarm-clock/lib';
import { ITransactionRequest } from '@ethereum-alarm-clock/lib/built/transactionRequest/ITransactionRequest';

const CLAIMING_GAS_ESTIMATE = 100000; // Claiming gas is around 75k, we add a small surplus

export interface IEconomicStrategyManager {
  strategy: IEconomicStrategy;

  shouldClaimTx(
    txRequest: ITransactionRequest,
    nextAccount: Address,
    gasPrice: BigNumber
  ): Promise<EconomicStrategyStatus>;
  shouldExecuteTx(txRequest: ITransactionRequest, gasPrice: BigNumber): Promise<boolean>;
  getExecutionGasPrice(txRequest: ITransactionRequest): Promise<BigNumber>;
}

export class EconomicStrategyManager {
  public strategy: IEconomicStrategy;

  private gasPriceUtil: GasPriceUtil;
  private util: Util;
  private logger: ILogger;
  private cache: Cache<ICachedTxDetails>;
  private eac: EAC;

  constructor(
    strategy: IEconomicStrategy,
    gasPriceUtil: GasPriceUtil,
    cache: Cache<ICachedTxDetails>,
    eac: EAC,
    util: Util,
    logger: ILogger = new DefaultLogger()
  ) {
    this.strategy = strategy;
    this.gasPriceUtil = gasPriceUtil;
    this.util = util;
    this.logger = logger;
    this.cache = cache;
    this.eac = eac;

    if (!this.strategy) {
      throw new Error('Unable to initialize EconomicStrategyManager, strategy is null');
    }

    this.logger.debug(`EconomicStrategyManager initialized with ${JSON.stringify(strategy)}`);
  }

  /**
   * Tests transaction if claiming should be performed
   *
   * @param {ITransactionRequest} txRequest Request under test
   * @param {Address} nextAccount Account
   * @returns {Promise<EconomicStrategyStatus>} Status
   * @memberof EconomicStrategyManager
   */
  public async shouldClaimTx(
    txRequest: ITransactionRequest,
    nextAccount: Address,
    fastestGas: BigNumber
  ): Promise<EconomicStrategyStatus> {
    const profitable = await this.isClaimingProfitable(txRequest, fastestGas);
    if (!profitable) {
      return EconomicStrategyStatus.NOT_PROFITABLE;
    }

    const enoughBalance = await this.isAboveMinBalanceLimit(nextAccount, txRequest);
    if (!enoughBalance) {
      return EconomicStrategyStatus.INSUFFICIENT_BALANCE;
    }

    const exceedsDepositLimit = this.exceedsMaxDeposit(txRequest);
    if (exceedsDepositLimit) {
      return EconomicStrategyStatus.DEPOSIT_TOO_HIGH;
    }

    const tooShortReserved = this.tooShortReserved(txRequest);
    if (tooShortReserved) {
      return EconomicStrategyStatus.TOO_SHORT_RESERVED;
    }

    const tooShortClaimWindow = await this.tooShortClaimWindow(txRequest);
    if (tooShortClaimWindow) {
      return EconomicStrategyStatus.TOO_SHORT_CLAIM_WINDOW;
    }

    return EconomicStrategyStatus.CLAIM;
  }

  public async getExecutionGasPrice(txRequest: ITransactionRequest): Promise<BigNumber> {
    const { average } = await this.gasPriceUtil.getAdvancedNetworkGasPrice();
    const currentNetworkPrice = this.strategy.usingSmartGasEstimation
      ? (await this.smartGasEstimation(txRequest)) || average
      : average;

    const minGasPrice = txRequest.gasPrice;
    const maxGasPrice = minGasPrice.times(this.maxSubsidyFactor);

    return currentNetworkPrice.greaterThan(maxGasPrice)
      ? maxGasPrice
      : currentNetworkPrice.lessThan(minGasPrice)
      ? minGasPrice
      : currentNetworkPrice;
  }

  public async shouldExecuteTx(
    txRequest: ITransactionRequest,
    targetGasPrice: BigNumber
  ): Promise<boolean> {
    const { gasPrice, requiredDeposit, bounty } = txRequest;
    const gasAmount = this.util.calculateGasAmount(txRequest);
    const reimbursement = gasPrice.times(gasAmount);

    const paymentModifier = (await txRequest.claimPaymentModifier()).dividedBy(100);
    const reward = bounty.times(paymentModifier);

    const gasCost = targetGasPrice.times(gasAmount);
    const expectedReward = reward
      .plus(reimbursement)
      .plus(txRequest.isClaimed ? requiredDeposit : 0);
    const shouldExecute = gasCost.lessThanOrEqualTo(expectedReward);

    this.logger.debug(
      `shouldExecuteTx: gasCost=${gasCost} <= expectedReward=${expectedReward} returns ${shouldExecute}`,
      txRequest.address
    );

    return shouldExecute;
  }

  private async tooShortClaimWindow(txRequest: ITransactionRequest): Promise<boolean> {
    const { minClaimWindowBlock, minClaimWindow } = this.strategy;
    const { claimWindowEnd, temporalUnit } = txRequest;
    const now = await txRequest.now();

    const minWindow = temporalUnit === 1 ? minClaimWindowBlock : minClaimWindow;

    return claimWindowEnd.sub(now).lt(minWindow);
  }

  private tooShortReserved(txRequest: ITransactionRequest): boolean {
    const { minExecutionWindowBlock, minExecutionWindow } = this.strategy;
    const { reservedWindowSize, temporalUnit } = txRequest;

    const minWindow = temporalUnit === 1 ? minExecutionWindowBlock : minExecutionWindow;

    return minWindow && reservedWindowSize.lt(minWindow);
  }

  private exceedsMaxDeposit(txRequest: ITransactionRequest): boolean {
    const requiredDeposit = txRequest.requiredDeposit;
    const maxDeposit = this.strategy.maxDeposit;

    return requiredDeposit.gt(maxDeposit);
  }

  private getTxRequestsClaimedBy(address: string): string[] {
    return this.cache.stored().filter((txAddress: string) => {
      const tx = this.cache.get(txAddress);
      return tx.claimedBy === address && !tx.wasCalled;
    });
  }

  private async isAboveMinBalanceLimit(
    nextAccount: Address,
    txRequest: ITransactionRequest
  ): Promise<boolean> {
    const minBalance = this.strategy.minBalance;
    const currentBalance: BigNumber = await this.util.balanceOf(nextAccount);
    const txRequestsClaimed: string[] = this.getTxRequestsClaimedBy(nextAccount);
    const gasPrices: BigNumber[] = await Promise.all(
      txRequestsClaimed.map(async (address: string) => {
        const tx = this.eac.transactionRequest(address);
        await tx.refreshData();

        return tx.gasPrice;
      })
    );

    let costOfExecutingFutureTransactions = new BigNumber(0);

    if (gasPrices.length) {
      const subsidyFactor = this.maxSubsidyFactor;
      costOfExecutingFutureTransactions = gasPrices.reduce((sum: BigNumber, current: BigNumber) =>
        sum.add(current.times(subsidyFactor))
      );
    }

    const requiredBalance = minBalance.add(costOfExecutingFutureTransactions);
    const isAboveMinBalanceLimit = currentBalance.gt(requiredBalance);

    this.logger.debug(
      `isAboveMinBalanceLimit: currentBalance=${currentBalance} > minBalance=${minBalance} + costOfExecutingFutureTransactions=${costOfExecutingFutureTransactions} returns ${isAboveMinBalanceLimit}`,
      txRequest.address
    );

    return isAboveMinBalanceLimit;
  }

  private async isClaimingProfitable(
    txRequest: ITransactionRequest,
    targetGasPrice: BigNumber
  ): Promise<boolean> {
    const paymentModifier = (await txRequest.claimPaymentModifier()).dividedBy(100);
    const claimingGasCost = targetGasPrice.times(CLAIMING_GAS_ESTIMATE);
    const reward = txRequest.bounty.times(paymentModifier).minus(claimingGasCost);
    const minProfitability = this.strategy.minProfitability;

    const isProfitable = reward.greaterThanOrEqualTo(minProfitability);

    this.logger.debug(
      `isClaimingProfitable: paymentModifier=${paymentModifier} targetGasPrice=${targetGasPrice} bounty=${
        txRequest.bounty
      } reward=${reward} >= minProfitability=${minProfitability} returns ${isProfitable}`,
      txRequest.address
    );

    return isProfitable;
  }

  private get maxSubsidyFactor(): number {
    const maxGasSubsidy = this.strategy.maxGasSubsidy / 100;
    return maxGasSubsidy + 1;
  }

  private async smartGasEstimation(txRequest: ITransactionRequest): Promise<BigNumber | null> {
    const gasStats = await GasPriceUtil.getEthGasStationStats();
    if (!gasStats) {
      return null;
    }

    const { temporalUnit } = txRequest;
    const now = await txRequest.now();
    const inReservedWindow = await txRequest.inReservedWindow();

    const timeLeft = inReservedWindow
      ? txRequest.reservedWindowEnd.sub(now)
      : txRequest.executionWindowEnd.sub(now);
    const normalizedTimeLeft = temporalUnit === 1 ? timeLeft.mul(gasStats.blockTime) : timeLeft;

    const gasEstimation = new NormalizedTimes(gasStats, temporalUnit).pickGasPrice(
      normalizedTimeLeft
    );

    this.logger.debug(
      `smartGasEstimation: inReservedWindow=${inReservedWindow} timeLeft=${timeLeft} normalizedTimeLeft=${normalizedTimeLeft} returns ${gasEstimation}`,
      txRequest.address
    );

    return gasEstimation;
  }
}
