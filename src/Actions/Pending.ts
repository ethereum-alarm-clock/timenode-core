import TxPool, { ITxPoolTxDetails } from '../TxPool';
import Config from '../Config';
import BigNumber from 'bignumber.js';
import { FnSignatures } from '../Enum';
import { ITxRequestPending } from '../Types/ITxRequest';
import { ITxRequest } from '../Types';

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
const hasPendingParity = (
  conf: Config,
  txRequest: ITxRequestPending,
  opts: PendingOpts
): Promise<boolean> => {
  opts.checkGasPrice = opts.checkGasPrice === undefined ? true : opts.checkGasPrice;
  const provider = conf.web3.currentProvider;

  return new Promise(async (resolve, reject) => {
    try {
      await provider.sendAsync(
        {
          jsonrpc: '2.0',
          method: 'parity_pendingTransactions',
          params: [],
          id: new Date().getTime()
        },
        async (err: Error, res: any) => {
          if (err || res.error || !res.result) {
            const errMsg =
              (err && err.message) || err || (res.error && res.error.message) || res.error;
            conf.logger.error(errMsg);
            return;
          }

          const currentGasPrice: BigNumber = await conf.util.networkGasPrice();
          for (const count of Object.keys(res.result)) {
            if (res.result[count].to === txRequest.address) {
              const withValidGasPrice =
                res.result[count] &&
                (!opts.checkGasPrice ||
                  (await hasValidGasPrice(currentGasPrice, res.result[count], opts.minPrice)));
              if (
                res.result[count] &&
                isOfType(res.result[count], opts.type) &&
                withValidGasPrice
              ) {
                resolve(true);
              }
            }
          }
          resolve(false);
        }
      );
    } catch (e) {
      conf.logger.error(e.message);
      return;
    }
  });
};

/**
 * Uses the Geth specific RPC request `txpool_content` to search
 * for pending transactions in the transaction pool.
 * @param {Config} conf Config object.
 * @param {TransactionRequest} txRequest
 * @param {string} type (optional) Type of pending request: claim,execute.
 * @param {boolean} checkGasPrice (optional, default: true) Check if transaction's gasPrice is sufficient for Network.
 * @param {number} minPrice (optional) Expected gasPrice.
 * @returns {Promise<object>} Transaction, if a pending transaction to this address exists.
 */
const hasPendingGeth = (
  conf: Config,
  txRequest: ITxRequestPending,
  opts: PendingOpts
): Promise<boolean> => {
  opts.checkGasPrice = opts.checkGasPrice === undefined ? true : opts.checkGasPrice;
  const provider = conf.web3.currentProvider;

  return new Promise((resolve, reject) => {
    try {
      provider.sendAsync(
        {
          jsonrpc: '2.0',
          method: 'txpool_content',
          params: [],
          id: new Date().getTime()
        },
        async (err: Error, res: any) => {
          if (err || res.error || !res.result) {
            const errMsg =
              (err && err.message) || err || (res.error && res.error.message) || res.error;
            conf.logger.error(errMsg);
            return;
          }

          const currentGasPrice: BigNumber = await conf.util.networkGasPrice();
          for (const account of Object.keys(res.result.pending)) {
            for (const nonce in res.result.pending[account]) {
              if (res.result.pending[account][nonce].to === txRequest.address) {
                const withValidGasPrice =
                  res.result.pending[account][nonce] &&
                  (!opts.checkGasPrice ||
                    (await hasValidGasPrice(
                      currentGasPrice,
                      res.result.pending[account][nonce],
                      opts.minPrice
                    )));
                if (
                  res.result.pending[account][nonce] &&
                  isOfType(res.result.pending[account][nonce], opts.type) &&
                  withValidGasPrice
                ) {
                  resolve(true);
                }
              }
            }
          }
          resolve(false);
        }
      );
    } catch (e) {
      conf.logger.error(e.message);
      return;
    }
  });
};

/**
 * Uses the locally maintained TxPool to check
 * for pending transactions in the transaction pool.
 * @param {Config} conf Config object.
 * @param {TransactionRequest} txRequest
 * @param {string} type (optional) Type of pending request: claim,execute.
 * @param {boolean} checkGasPrice (optional, default: true) Check if transaction's gasPrice is sufficient for Network.
 * @param {number} minPrice (optional) Expected gasPrice.
 * @returns {Promise<object>} Transaction, if a pending transaction to this address exists.
 */
const hasPendingPool = async (
  conf: Config,
  txRequest: ITxRequestPending,
  opts: PendingOpts
): Promise<boolean> => {
  let validPending: ITxPoolTxDetails[] = [];

  try{
    const currentGasPrice: BigNumber = await conf.util.networkGasPrice();
    validPending = await conf.txPool.pool.get(txRequest.address, 'to')
      .filter( async(tx: ITxPoolTxDetails) => {
        const withValidGasPrice =
          (!opts.checkGasPrice ||
            (hasValidGasPrice(
              currentGasPrice,
              tx,
              opts.minPrice
              )));
        return isOfType(tx, opts.type) && withValidGasPrice
      })
  } catch (e) {
    conf.logger.info(e);
  }
  return validPending.length > 0;

};

/**
 * Checks that pending transactions in the transaction pool have valid gasPrices.
 * @param {Config} conf Config object.
 * @param {TransactionReceipt} transaction Ethereum transaction receipt
 * @param {number} minPrice (optional) Expected gasPrice.
 * @returns {Promise<boolean>} Transaction, if a pending transaction to this address exists.
 */
const hasValidGasPrice = (networkPrice: BigNumber, transaction: ITxPoolTxDetails, minPrice?: BigNumber) => {
  if (minPrice) {
    return minPrice.valueOf() === transaction.gasPrice.valueOf();
  }
  const spread = 0.3;
  return networkPrice && networkPrice.times(spread).valueOf() <= transaction.gasPrice.valueOf();
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
 * Depening on the client, routes the correct RPC request to return whether
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
  } else if (conf.client === 'parity') {
    result = await hasPendingParity(conf, txRequest, opts);
  } else if (conf.client === 'geth') {
    result = await hasPendingGeth(conf, txRequest, opts);
  }

  return result;
};

export default hasPending;
