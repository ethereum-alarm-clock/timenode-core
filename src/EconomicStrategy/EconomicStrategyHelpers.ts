import BigNumber from 'bignumber.js';
import Config from '../Config';
import * as Bb from 'bluebird';

/**
 * Checks whether a transaction requires a deposit that's higher than a
 * user-set maximum deposit limit.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {Config} config TimeNode configuration object.
 */
const exceedsMaxDeposit = (txRequest: any, config: Config) => {
  const requiredDeposit = txRequest.requiredDeposit();
  const maxDeposit = config.economicStrategy.maxDeposit;

  return requiredDeposit.gt(maxDeposit);
};

/**
 * Checks if the balance of the TimeNode is above a set limit.
 * @param {Config} config TimeNode configuration object.
 */
const isAboveMinBalanceLimit = async (config: Config) => {
  const minBalance = config.economicStrategy.minBalance;
  const currentBalance = await Bb.fromCallback((callback) =>
    config.web3.eth.getBlockNumber(callback)
  );

  return currentBalance.gt(minBalance);
};

/**
 * Compares the profitability user settings and checks if the TimeNode
 * should claim a transaction.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {Config} config TimeNode configuration object.
 */
const isProfitable = async (txRequest: any, config: Config) => {
  const paymentModifier = await txRequest.claimPaymentModifier();
  const minProfitability = config.economicStrategy.minProfitability;

  if (minProfitability.gt(0)) {
    return paymentModifier.lt(minProfitability);
  }

  return true;
};

export { isProfitable, isAboveMinBalanceLimit, exceedsMaxDeposit };
