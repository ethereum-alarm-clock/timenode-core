import { IEconomicStrategy } from './IEconomicStrategy';
import Config from '../Config';
import { BigNumber } from 'bignumber.js';
import { ITxRequest } from '../Types';

/**
 * Checks whether a transaction requires a deposit that's higher than a
 * user-set maximum deposit limit.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {IEconomicStrategy} economicStrategy Economic strategy configuration object.
 */
const exceedsMaxDeposit = (txRequest: ITxRequest, economicStrategy: IEconomicStrategy): boolean => {
  const requiredDeposit = txRequest.requiredDeposit;
  const maxDeposit = economicStrategy.maxDeposit;

  if (maxDeposit && maxDeposit.gt(0)) {
    return requiredDeposit.gt(maxDeposit);
  }

  return false;
};

/**
 * Checks if the balance of the TimeNode is above a set limit.
 * @param {Config} config TimeNode configuration object.
 */
const isAboveMinBalanceLimit = async (config: Config): Promise<boolean> => {
  const minBalance = config.economicStrategy.minBalance;
  const currentBalance = await config.wallet.getBalanceOf(config.wallet.getAddresses()[0]);

  if (minBalance) {
    return currentBalance.gt(minBalance);
  }
  return true;
};

/**
 * Compares the profitability user settings and checks if the TimeNode
 * should claim a transaction.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {IEconomicStrategy} economicStrategy Economic strategy configuration object.
 */
const isProfitable = async (
  txRequest: ITxRequest,
  economicStrategy: IEconomicStrategy
): Promise<boolean> => {
  const paymentModifier = await txRequest.claimPaymentModifier();
  const reward = txRequest.bounty.times(paymentModifier);

  const minProfitability = economicStrategy.minProfitability;

  if (minProfitability && minProfitability.gt(0)) {
    return reward.gt(minProfitability);
  }

  return true;
};

/**
 * Validates all the economic strategy parameters before claiming a certain transaction.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {Config} config Configuration object.
 */
const shouldClaimTx = async (txRequest: ITxRequest, config: Config): Promise<boolean> => {
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

/**
 * Calculates the correct gas price to use for execution, taking into consideration
 * the economicStrategy `maxGasSubsidy` and the current network conditions.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {Config} config Configuration object.
 */
const getExecutionGasPrice = async (txRequest: ITxRequest, config: Config): Promise<BigNumber> => {
  const currentNetworkPrice = await config.util.networkGasPrice();

  if (!config.economicStrategy) {
    return currentNetworkPrice;
  }

  const maxGasSubsidy = config.economicStrategy.maxGasSubsidy;

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
};

/**
 * Checks if the transaction is profitable to be executed when considering the
 * current network gas prices.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {Config} config Configuration object.
 */
const shouldExecuteTx = async (txRequest: ITxRequest, config: Config): Promise<boolean> => {
  const isClaimedByMe = config.wallet.getAddresses().indexOf(txRequest.claimedBy) !== -1;

  const gasPrice = await this.getExecutionGasPrice(txRequest, config);
  const gasAmount = config.util.calculateGasAmount(txRequest);
  const reimbursement = txRequest.gasPrice.times(gasAmount);
  const deposit = isClaimedByMe ? txRequest.requiredDeposit : new BigNumber(0);

  const paymentModifier = await txRequest.claimPaymentModifier();
  const reward = txRequest.bounty.times(paymentModifier);

  const gasCost = gasPrice.times(gasAmount);
  const expectedReward = deposit.plus(reward).plus(reimbursement);
  const shouldExecute = gasCost.lessThanOrEqualTo(expectedReward);

  config.logger.debug(
    `shouldExecuteTx ret ${shouldExecute} gasCost=${gasCost.toNumber()} expectedReward=${expectedReward.toNumber()}`,
    txRequest.address
  );

  return shouldExecute;
};

export { shouldClaimTx, shouldExecuteTx, getExecutionGasPrice };
