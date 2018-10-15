import { BigNumber } from 'bignumber.js';

import { W3Util } from '..';
import Cache, { ICachedTxDetails } from '../Cache';
import { EconomicStrategyStatus } from '../Enum';
import { ILogger, DefaultLogger } from '../Logger';
import { Address, ITxRequest, EthGasStationInfo } from '../Types';
import { IEconomicStrategy } from './IEconomicStrategy';

const CLAIMING_GAS_ESTIMATE = 100000; // Claiming gas is around 75k, we add a small surplus

export interface IEconomicStrategyManager {
  strategy: IEconomicStrategy;

  shouldClaimTx(
    txRequest: ITxRequest,
    nextAccount: Address,
    gasPrice: BigNumber
  ): Promise<EconomicStrategyStatus>;
  shouldExecuteTx(txRequest: ITxRequest, gasPrice: BigNumber): Promise<boolean>;
  getExecutionGasPrice(txRequest: ITxRequest): Promise<BigNumber>;
}

export class EconomicStrategyManager {
  public strategy: IEconomicStrategy;

  private util: W3Util;
  private logger: ILogger;
  private cache: Cache<ICachedTxDetails>;
  private eac: any;

  constructor(
    strategy: IEconomicStrategy,
    util: W3Util,
    cache: Cache<ICachedTxDetails>,
    eac: any,
    logger: ILogger = new DefaultLogger()
  ) {
    this.strategy = strategy;
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
   * @param {ITxRequest} txRequest Request under test
   * @param {Address} nextAccount Account
   * @returns {Promise<EconomicStrategyStatus>} Status
   * @memberof EconomicStrategyManager
   */
  public async shouldClaimTx(
    txRequest: ITxRequest,
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

    const windowTooShort = this.windowTooShort(txRequest);
    if (windowTooShort) {
      return EconomicStrategyStatus.WINDOW_TOO_SHORT;
    }

    return EconomicStrategyStatus.CLAIM;
  }

  /**
   * Calculates the correct gas price to use for execution, taking into consideration
   * the economicStrategy `maxGasSubsidy` and the current network conditions.
   * @param {TransactionRequest} txRequest Transaction Request object to check.
   * @param {Config} config Configuration object.
   */
  public async getExecutionGasPrice(txRequest: ITxRequest): Promise<BigNumber> {
    const { average } = await this.util.getAdvancedNetworkGasPrice();
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

  /**
   * Checks if the transaction is profitable to be executed when considering the
   * current network gas prices.
   * @param {TransactionRequest} txRequest Transaction Request object to check.
   * @param {Config} config Configuration object.
   */
  public async shouldExecuteTx(txRequest: ITxRequest, gasPrice: BigNumber): Promise<boolean> {
    const gasAmount = this.util.calculateGasAmount(txRequest);
    const reimbursement = txRequest.gasPrice.times(gasAmount);
    const deposit = txRequest.requiredDeposit;

    const paymentModifier = (await txRequest.claimPaymentModifier()).dividedBy(100);
    const reward = txRequest.bounty.times(paymentModifier);

    const gasCost = gasPrice.times(gasAmount);
    const expectedReward = deposit.plus(reward).plus(reimbursement);
    const shouldExecute = gasCost.lessThanOrEqualTo(expectedReward);

    this.logger.debug(
      `shouldExecuteTx: gasCost=${gasCost} <= expectedReward=${expectedReward} returns ${shouldExecute}`,
      txRequest.address
    );

    return shouldExecute;
  }

  private windowTooShort(txRequest: ITxRequest): boolean {
    const minimumWindow =
      txRequest.temporalUnit === 1
        ? this.strategy.minExecutionWindowBlock
        : this.strategy.minExecutionWindow;
    if (!minimumWindow) {
      return false;
    }

    return txRequest.reservedWindowSize.lessThan(minimumWindow);
  }

  private exceedsMaxDeposit(txRequest: ITxRequest): boolean {
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
    txRequest: ITxRequest
  ): Promise<boolean> {
    const minBalance = this.strategy.minBalance;
    const currentBalance = await this.util.balanceOf(nextAccount);
    const txRequestsClaimed: string[] = this.getTxRequestsClaimedBy(nextAccount);
    const gasPrices: BigNumber[] = await Promise.all(
      txRequestsClaimed.map(async (address: string) => {
        const tx = await this.eac.transactionRequest(address);
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

  private async isClaimingProfitable(txRequest: ITxRequest, gasPrice: BigNumber): Promise<boolean> {
    const paymentModifier = (await txRequest.claimPaymentModifier()).dividedBy(100);
    const claimingGasCost = gasPrice.times(CLAIMING_GAS_ESTIMATE);
    const reward = txRequest.bounty.times(paymentModifier).minus(claimingGasCost);
    const minProfitability = this.strategy.minProfitability;

    const isProfitable = reward.greaterThanOrEqualTo(minProfitability);

    this.logger.debug(
      `isClaimingProfitable: paymentModifier=${paymentModifier} gasPrice=${gasPrice} bounty=${
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

  private normalizeWaitTimes = (temporalUnit: number, stats: EthGasStationInfo) => {
    let normalizedTimes = {
      safeLow: stats.safeLowWait.mul(10),
      avg: stats.avgWait.mul(10),
      fast: stats.fastWait.mul(10),
      fastest: stats.fastestWait.mul(10)
    };

    if (temporalUnit === 1) {
      // Normalize the estimate
      const { blockTime } = stats;
      normalizedTimes = {
        safeLow: normalizedTimes.safeLow.div(blockTime).round(),
        avg: normalizedTimes.avg.div(blockTime).round(),
        fast: normalizedTimes.fast.div(blockTime).round(),
        fastest: normalizedTimes.fastest.div(blockTime).round()
      };
    }

    return normalizedTimes;
  };

  private returnRightGas = (timeLeft: BigNumber, normTimes: any, gasStats: EthGasStationInfo) => {
    if (timeLeft > normTimes.safeLow) {
      return gasStats.safeLow;
    } else if (timeLeft > normTimes.avg) {
      return gasStats.average;
    } else if (timeLeft > normTimes.fast) {
      return gasStats.fast;
    } else if (timeLeft > normTimes.fastest) {
      return gasStats.fastest;
    } else {
      return null;
    }
  };

  private async smartGasEstimation(txRequest: ITxRequest): Promise<BigNumber | null> {
    const gasStats = await W3Util.getEthGasStationStats();
    if (!gasStats) {
      return null;
    }

    const { temporalUnit } = txRequest;
    const normTimes = this.normalizeWaitTimes(temporalUnit, gasStats);
    const now = await txRequest.now();
    const inReservedWindow = await txRequest.inReservedWindow();

    const timeLeft = inReservedWindow
      ? now.sub(txRequest.reservedWindowEnd)
      : now.sub(txRequest.executionWindowEnd);
    const normalizedTimeLeft = temporalUnit === 1 ? timeLeft.mul(gasStats.blockTime) : timeLeft;

    const gasEstimation = this.returnRightGas(normalizedTimeLeft, normTimes, gasStats);

    this.logger.debug(
      `smartGasEstimation: inReservedWindow=${inReservedWindow} timeLeft=${timeLeft} normalizedTimeLeft=${normalizedTimeLeft} returns ${gasEstimation}`,
      txRequest.address
    );

    return gasEstimation;
  }
}
