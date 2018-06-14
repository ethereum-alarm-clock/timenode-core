import BigNumber from 'bignumber.js';
import Config from '../Config';
import * as Bb from 'bluebird';

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
 * @param {BigNumber} minProfitability Minimum profitability.
 */
const isProfitable = async (txRequest: any, minProfitability: BigNumber) => {
  const paymentModifier = await txRequest.claimPaymentModifier();

  if (minProfitability.gt(0)) {
    return paymentModifier.lt(minProfitability);
  }

  return true;
};

export { isProfitable, isAboveMinBalanceLimit };
