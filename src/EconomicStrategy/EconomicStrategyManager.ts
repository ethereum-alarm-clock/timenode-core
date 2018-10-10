import { BigNumber } from 'bignumber.js';

import { W3Util } from '..';
import Cache, { ICachedTxDetails } from '../Cache';
import { EconomicStrategyStatus } from '../Enum';
import { ILogger, DefaultLogger } from '../Logger';
import { Address, ITxRequest } from '../Types';
import { IEconomicStrategy } from './IEconomicStrategy';

const CLAIMING_GAS_ESTIMATE = 100000; // Claiming gas is around 75k, we add a small surplus

export interface IEconomicStrategyManager {
  strategy: IEconomicStrategy;

  shouldClaimTx(txRequest: ITxRequest, nextAccount: Address): Promise<EconomicStrategyStatus>;
  shouldExecuteTx(txRequest: ITxRequest): Promise<boolean>;
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
    nextAccount: Address
  ): Promise<EconomicStrategyStatus> {
    if (!this.strategy) {
      return EconomicStrategyStatus.CLAIM;
    }

    const profitable = await this.isClaimingProfitable(txRequest);
    if (!profitable) {
      return EconomicStrategyStatus.NOT_PROFITABLE;
    }

    const enoughBalance = await this.isAboveMinBalanceLimit(nextAccount);
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
    const currentNetworkPrice = await this.util.networkGasPrice();

    if (!this.strategy) {
      return currentNetworkPrice;
    }

    const maxGasSubsidy = this.strategy.maxGasSubsidy;

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
  public async shouldExecuteTx(txRequest: ITxRequest): Promise<boolean> {
    const gasPrice = await this.getExecutionGasPrice(txRequest);
    const gasAmount = this.util.calculateGasAmount(txRequest);
    const reimbursement = txRequest.gasPrice.times(gasAmount);
    const deposit = txRequest.requiredDeposit;

    const paymentModifier = await txRequest.claimPaymentModifier();
    const reward = txRequest.bounty.times(paymentModifier);

    const gasCost = gasPrice.times(gasAmount);
    const expectedReward = deposit.plus(reward).plus(reimbursement);
    const shouldExecute = gasCost.lessThanOrEqualTo(expectedReward);

    this.logger.debug(
      `shouldExecuteTx ret ${shouldExecute} gasCost=${gasCost.toNumber()} expectedReward=${expectedReward.toNumber()}`,
      txRequest.address
    );

    return shouldExecute;
  }

  private windowTooShort(txRequest: ITxRequest): boolean {
    const minimumWIndow =
      txRequest.temporalUnit === 1
        ? this.strategy.minExecutionWindowBlock
        : this.strategy.minExecutionWindow;
    if (!minimumWIndow) {
      return false;
    }

    return txRequest.reservedWindowSize.lessThan(minimumWIndow);
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

  private async isAboveMinBalanceLimit(nextAccount: Address): Promise<boolean> {
    const minBalance = this.strategy.minBalance;

    // Determine the next batter up to claim.
    const currentBalance = await this.util.balanceOf(nextAccount);

    // Subtract the maximum gas costs of executing all currently claimed
    // transactions. This is to ensure that a TimeNode does not fail to execute
    // because it ran out of funds.
    const txRequestsClaimed: string[] = this.getTxRequestsClaimedBy(nextAccount);

    this.logger.debug(`txRequestClaimed=${txRequestsClaimed}`);

    const gasPricesPromise = txRequestsClaimed.map(async (address: string) => {
      const txRequest = await this.eac.transactionRequest(address);
      await txRequest.refreshData();

      return txRequest.gasPrice;
    });

    const gasPrices: BigNumber[] = await Promise.all(gasPricesPromise);

    if (gasPrices.length) {
      const maxGasSubsidy = this.strategy.maxGasSubsidy;

      const costOfExecutingFutureTransactions = gasPrices.reduce(
        (sum: BigNumber, current: BigNumber) => {
          if (maxGasSubsidy) {
            const maxGasPrice = current.plus(current.times(maxGasSubsidy / 100));
            return sum.add(maxGasPrice);
          }
          return sum.add(current);
        }
      );

      if (minBalance) {
        return currentBalance.gt(minBalance.add(costOfExecutingFutureTransactions));
      }
    }

    if (minBalance) {
      return currentBalance.gt(minBalance);
    }
    return true;
  }

  private async isClaimingProfitable(txRequest: ITxRequest): Promise<boolean> {
    const paymentModifier = await txRequest.claimPaymentModifier();
    const claimingGas = new BigNumber(CLAIMING_GAS_ESTIMATE);

    const claimingGasPrice = (await this.util.getAdvancedNetworkGasPrice()).fastest;
    const claimingGasCost = claimingGasPrice.times(claimingGas);

    const reward = txRequest.bounty.times(paymentModifier).minus(claimingGasCost);

    const minProfitability = this.strategy.minProfitability;

    if (minProfitability && minProfitability.gt(0)) {
      return reward.gt(minProfitability);
    }

    return true;
  }
}
