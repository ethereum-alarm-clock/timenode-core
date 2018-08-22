import TxPool, { ITxPoolTxDetails } from '../TxPool';
import Config from '../Config';
import BigNumber from 'bignumber.js';
import { FnSignatures } from '../Enum';
import { ITxRequestPending } from '../Types/ITxRequest';

interface PendingOpts {
  type?: string;
  checkGasPrice: boolean;
  minPrice?: BigNumber;
}

/**
 * Uses the locally maintained TxPool to check
 * for pending transactions in the transaction pool.
 * @param {Config} conf Config object.
 * @param {TransactionRequest} txRequest
 * @param {string} type (optional) Type of pending request: claim,execute.
 * @param {boolean} checkGasPrice (optional, default: true) Check if transaction's gasPrice is sufficient for Network.
 * @param {number} minPrice (optional) Expected gasPrice.
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const hasPendingPool = async (
  conf: Config,
  txRequest: ITxRequestPending,
  opts: PendingOpts
): Promise<boolean> => {
  let validPending: (boolean | ITxPoolTxDetails)[] = [];

  try{
    const currentGasPrice: BigNumber = await conf.util.networkGasPrice();
    validPending = conf.txPool.pool.get(txRequest.address, 'to')
    .filter( (tx: ITxPoolTxDetails) => {
        const withValidGasPrice =
          (!opts.checkGasPrice ||
            (hasValidGasPrice(
              currentGasPrice,
              tx,
              opts.minPrice
              )));
        return isOfType(tx, opts.type) && withValidGasPrice
      })
    return validPending.length > 0;  
  } catch (e) {
    conf.logger.info(e);
  }
};

/**
 * Checks that pending transactions in the transaction pool have valid gasPrices.
 * @param {Config} conf Config object.
 * @param {TransactionReceipt} transaction Ethereum transaction receipt
 * @param {number} minPrice (optional) Expected gasPrice.
 * @returns {Promise<boolean>} Transaction, if a pending transaction to this address exists.
 */
const hasValidGasPrice = (networkPrice: BigNumber, transaction: ITxPoolTxDetails, minPrice?: BigNumber) => {
  const spread = 0.3;
  const hasMinPrice: boolean = !minPrice || minPrice.lte(transaction.gasPrice);
  return hasMinPrice && networkPrice && networkPrice.times(spread).lte(transaction.gasPrice.valueOf());
};

/**
 * Uses the Geth specific RPC request `txpool_content` to search
 * for pending transactions in the transaction pool.
 * @param {TransactionReceipt} transaction Ethereum transaction receipt
 * @param {string} type Type of pending request: claim,execute.
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const isOfType = (transaction: ITxPoolTxDetails, type?: string) => {
  if (transaction && !type) {
    return true;
  }
  return transaction.input === FnSignatures[type];
};

/**
 * Uses a locally maintained TxPool to return whether
 * a TransactionRequest has a pending transaction in the transaction pool.
 * @param {Config} conf Config object.
 * @param {TransactionRequest} txRequest Transaction Request object to check.
 * @param {string} type (optional) Type of pending request: claim,execute.
 * @param {boolean} checkGasPrice (optional, default: true) Check if transaction's gasPrice is sufficient for Network.
 * @param {number} minPrice (optional) Expected gasPrice to compare.
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const hasPending = async (
  conf: Config,
  txRequest: ITxRequestPending,
  opts: PendingOpts
): Promise<boolean> => {
  let result: boolean = false;
  if (conf.txPool && conf.txPool.running()) {
    result = await hasPendingPool(conf, txRequest, opts)
  }
  return result;
};

export default hasPending;
