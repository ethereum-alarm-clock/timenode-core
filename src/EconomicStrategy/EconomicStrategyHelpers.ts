import BigNumber from 'bignumber.js';

/**
 * Compares the profitability user settings and checks if the TimeNode
 * should claim a transaction.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {Config} conf Config object.
 */
const isProfitable = async (txRequest: any, minProfitability: BigNumber) => {
  const paymentModifier = await txRequest.claimPaymentModifier();

  if (minProfitability.gt(0)) {
    return paymentModifier.lt(minProfitability);
  }

  return true;
};

export { isProfitable };
