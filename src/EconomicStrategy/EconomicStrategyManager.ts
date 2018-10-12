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
    if (!this.strategy) {
      return EconomicStrategyStatus.CLAIM;
    }

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

    let currentNetworkPrice = average;

    if (!this.strategy) {
      return currentNetworkPrice;
    }

    if (this.strategy.usingSmartGasEstimation) {
      const smartGasEstimate = await this.smartGasEstimation(txRequest);
      if (smartGasEstimate) {
        currentNetworkPrice = smartGasEstimate;
      }
    }

    const { maxGasSubsidy } = this.strategy;

    if (typeof maxGasSubsidy !== 'undefined' && maxGasSubsidy !== null) {
      const minGasPrice = txRequest.gasPrice;
      const maxGasPrice = minGasPrice.plus(minGasPrice.times(maxGasSubsidy / 100));

      if (currentNetworkPrice.lessThan(minGasPrice)) {
        return minGasPrice;
      } else if (
        currentNetworkPrice.greaterThanOrEqualTo(minGasPrice) &&
        currentNetworkPrice.lessThan(maxGasPrice)
      ) {
        return currentNetworkPrice;
      } else if (currentNetworkPrice.greaterThanOrEqualTo(maxGasPrice)) {
        return maxGasPrice;
      }
    }

    return currentNetworkPrice;
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

    if (maxDeposit && maxDeposit.gt(0)) {
      return requiredDeposit.gt(maxDeposit);
    }

    return false;
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
    let minBalance = this.strategy.minBalance || new BigNumber(0);

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
      const maxGasSubsidy = (this.strategy.maxGasSubsidy || 0) / 100;
      const subsidyFactor = maxGasSubsidy + 1;
      costOfExecutingFutureTransactions = gasPrices.reduce((sum: BigNumber, current: BigNumber) =>
        sum.add(current.times(subsidyFactor))
      );

      minBalance = minBalance.add(costOfExecutingFutureTransactions);
    }

    const isAboveMinBalanceLimit = currentBalance.gt(minBalance);

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
    const minProfitability = this.strategy.minProfitability || new BigNumber(0);

    const isProfitable = reward.greaterThanOrEqualTo(minProfitability);

    this.logger.debug(
      `isClaimingProfitable: paymentModifier=${paymentModifier} gasPrice=${gasPrice} bounty=${
        txRequest.bounty
      } reward=${reward} >= minProfitability=${minProfitability} returns ${isProfitable}`,
      txRequest.address
    );

    return isProfitable;
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
    // Reserved, need to send transaction before it goes to general window.
    if (await txRequest.inReservedWindow()) {
      let timeLeftInReservedWindow = (await txRequest.now()).sub(txRequest.reservedWindowEnd);
      if (temporalUnit === 1) {
        timeLeftInReservedWindow = timeLeftInReservedWindow.mul(gasStats.blockTime);
      }
      return this.returnRightGas(timeLeftInReservedWindow, normTimes, gasStats);
    } else {
      // No longer reserved, just send it before it times out.
      let timeLeftInExecutionWindow = (await txRequest.now()).sub(txRequest.executionWindowEnd);
      if (temporalUnit === 1) {
        timeLeftInExecutionWindow = timeLeftInExecutionWindow.mul(gasStats.blockTime);
      }
      return this.returnRightGas(timeLeftInExecutionWindow, normTimes, gasStats);
    }
  }
}
