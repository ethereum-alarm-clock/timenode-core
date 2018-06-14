import * as Bb from 'bluebird';
import { IEconomicStrategy } from './IEconomicStrategy';
import Config from '../Config';

/**
 * Checks whether a transaction requires a deposit that's higher than a
 * user-set maximum deposit limit.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {IEconomicStrategy} economicStrategy Economic strategy configuration object.
 */
const exceedsMaxDeposit = (
  txRequest: any,
  economicStrategy: IEconomicStrategy
) => {
  const requiredDeposit = txRequest.requiredDeposit;
  const maxDeposit = economicStrategy.maxDeposit;

  return requiredDeposit.gt(maxDeposit);
};

/**
 * Checks if the balance of the TimeNode is above a set limit.
 * @param {IEconomicStrategy} economicStrategy Economic strategy configuration object.
 * @param {Web3} web3 The Web3 object
 */
const isAboveMinBalanceLimit = async (
  economicStrategy: IEconomicStrategy,
  web3: any
) => {
  const minBalance = economicStrategy.minBalance;
  const currentBalance = await Bb.fromCallback((callback) =>
    web3.eth.getBalance(web3.eth.accounts[0], callback)
  );

  return currentBalance.gt(minBalance);
};

/**
 * Compares the profitability user settings and checks if the TimeNode
 * should claim a transaction.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {IEconomicStrategy} economicStrategy Economic strategy configuration object.
 */
const isProfitable = async (
  txRequest: any,
  economicStrategy: IEconomicStrategy
) => {
  const paymentModifier = await txRequest.claimPaymentModifier();
  const minProfitability = economicStrategy.minProfitability;

  if (minProfitability.gt(0)) {
    return paymentModifier.lt(minProfitability);
  }

  return true;
};

const shouldClaimTx = async (txRequest: any, config: Config) => {
  const profitable = await isProfitable(txRequest, config.economicStrategy);
  if (!profitable) return false;

  const enoughBalance = await isAboveMinBalanceLimit(
    config.economicStrategy,
    config.web3
  );
  if (!enoughBalance) return false;

  const exceedsDepositLimit = exceedsMaxDeposit(txRequest, config.economicStrategy);

  return profitable && enoughBalance && !exceedsDepositLimit;
};

export { shouldClaimTx };
