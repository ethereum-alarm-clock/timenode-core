import * as Bb from 'bluebird';
import { IEconomicStrategy } from './IEconomicStrategy';
import Config from '../Config';

/**
 * Checks whether a transaction requires a deposit that's higher than a
 * user-set maximum deposit limit.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {IEconomicStrategy} economicStrategy Economic strategy configuration object.
 */
const exceedsMaxDeposit = (txRequest: any, economicStrategy: IEconomicStrategy) => {
  const requiredDeposit = txRequest.requiredDeposit;
  const maxDeposit = economicStrategy.maxDeposit;

  if (maxDeposit.gt(0)) {
    return requiredDeposit.gt(maxDeposit);
  }

  return false;
};

/**
 * Checks if the balance of the TimeNode is above a set limit.
 * @param {Config} config TimeNode configuration object.
 */
const isAboveMinBalanceLimit = async (config: Config) => {
  const minBalance = config.economicStrategy.minBalance;
  const currentBalance = await config.wallet.getBalanceOf(config.wallet.getAddresses()[0]);
  return currentBalance.gt(minBalance);
};

/**
 * Compares the profitability user settings and checks if the TimeNode
 * should claim a transaction.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {IEconomicStrategy} economicStrategy Economic strategy configuration object.
 */
const isProfitable = async (txRequest: any, economicStrategy: IEconomicStrategy) => {
  const paymentModifier = await txRequest.claimPaymentModifier();
  const reward = txRequest.bounty.times(paymentModifier);

  const minProfitability = economicStrategy.minProfitability;

  if (minProfitability.gt(0)) {
    return reward.gt(minProfitability);
  }

  return true;
};

const shouldClaimTx = async (txRequest: any, config: Config) => {
  if (!config.economicStrategy) {
    return true;
  }

  const profitable = await isProfitable(txRequest, config.economicStrategy);
  if (!profitable) {
    return false;
  }

  const enoughBalance = await isAboveMinBalanceLimit(config);
  if (!enoughBalance) {
    return false;
  }

  const exceedsDepositLimit = exceedsMaxDeposit(txRequest, config.economicStrategy);

  return profitable && enoughBalance && !exceedsDepositLimit;
};

export { shouldClaimTx };
