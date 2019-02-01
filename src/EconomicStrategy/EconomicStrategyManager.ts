import { BigNumber } from 'bignumber.js';
import Cache, { ICachedTxDetails } from '../Cache';
import { EconomicStrategyStatus } from '../Enum';
import { ILogger, DefaultLogger } from '../Logger';
import { Address } from '../Types';
import { IEconomicStrategy } from './IEconomicStrategy';
import { NormalizedTimes } from './NormalizedTimes';
import { EAC, Util, GasPriceUtil, ITransactionRequest } from '@ethereum-alarm-clock/lib';
import { ProfitabilityCalculator } from './ProfitabilityCalculator';

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
  private profitabilityCalculator: ProfitabilityCalculator;

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
    this.profitabilityCalculator = new ProfitabilityCalculator(util, gasPriceUtil, logger);

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
    gasPrice: BigNumber
  ): Promise<EconomicStrategyStatus> {
    const profitable = await this.isClaimingProfitable(txRequest, gasPrice);
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

    return currentNetworkPrice.greaterThan(minGasPrice) ? currentNetworkPrice : minGasPrice;
  }

  public async shouldExecuteTx(
    txRequest: ITransactionRequest,
    targetGasPrice: BigNumber
  ): Promise<boolean> {
    const expectedProfit = await this.profitabilityCalculator.executionProfitability(
      txRequest,
      targetGasPrice
    );
    const shouldExecute = expectedProfit.greaterThanOrEqualTo(0);

    this.logger.debug(
      `shouldExecuteTx: expectedProfit=${expectedProfit} >= 0 returns ${shouldExecute}`,
      txRequest.address
    );

    return shouldExecute;
  }

  private async tooShortClaimWindow(txRequest: ITransactionRequest): Promise<boolean> {
    const { minClaimWindowBlock, minClaimWindow } = this.strategy;
    const { claimWindowEnd, temporalUnit } = txRequest;
    const now = await txRequest.now();

    const minWindow = temporalUnit === 1 ? minClaimWindowBlock : minClaimWindow;

    return claimWindowEnd.minus(now).lt(minWindow);
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
        sum.plus(current.times(subsidyFactor))
      );
    }

    const requiredBalance = minBalance.plus(costOfExecutingFutureTransactions);
    const isAboveMinBalanceLimit = currentBalance.gt(requiredBalance);

    this.logger.debug(
      `isAboveMinBalanceLimit: currentBalance=${currentBalance} > minBalance=${minBalance} + costOfExecutingFutureTransactions=${costOfExecutingFutureTransactions} returns ${isAboveMinBalanceLimit}`,
      txRequest.address
    );

    return isAboveMinBalanceLimit;
  }

  private async isClaimingProfitable(
    txRequest: ITransactionRequest,
    claimingGasPrice: BigNumber
  ): Promise<boolean> {
    const expectedProfit = await this.profitabilityCalculator.claimingProfitability(
      txRequest,
      claimingGasPrice
    );
    const minProfitability = this.strategy.minProfitability;
    const isProfitable = expectedProfit.greaterThanOrEqualTo(minProfitability);

    this.logger.debug(
      `isClaimingProfitable:  claimingGasPrice=${claimingGasPrice} expectedProfit=${expectedProfit} >= minProfitability=${minProfitability} returns ${isProfitable}`,
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
      ? txRequest.reservedWindowEnd.plus(now)
      : txRequest.executionWindowEnd.plus(now);
    const normalizedTimeLeft =
      temporalUnit === 1 ? timeLeft.multipliedBy(gasStats.blockTime) : timeLeft;

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
