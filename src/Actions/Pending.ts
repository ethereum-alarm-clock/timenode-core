import Cache from '../Cache';
import { FnSignatures } from '../Enum';

interface PendingOpts {
  type?: string;
  checkGasPrice?: boolean;
  minPrice?: number;
}

/**
 * Uses the Parity specific RPC request `parity_pendingTransactions` to search
 * for pending transactions in the transaction pool.
 * @param {TransactionRequest} txRequest
 * @param {string} type (optional) Type of pending request: claim,execute.
 * @param {boolean} checkGasPrice (optional, default: true) Check if transaction's gasPrice is sufficient for Network.
 * @param {number} minPrice (optional) Expected gasPrice.
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const hasPendingParity = (conf: any, txRequest: any, opts: PendingOpts): Promise<boolean> => {
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

          for (const count of Object.keys(res.result)) {
            if (res.result[count].to === txRequest.address) {
              const withValidGasPrice =
                res.result[count] &&
                (!opts.checkGasPrice ||
                  (await hasValidGasPrice(conf, res.result[count], opts.minPrice)));
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
 * @param {TransactionRequest} txRequest
 * @param {string} type (optional) Type of pending request: claim,execute.
 * @param {boolean} checkGasPrice (optional, default: true) Check if transaction's gasPrice is sufficient for Network.
 * @param {number} minPrice (optional) Expected gasPrice.
 * @returns {Promise<object>} Transaction, if a pending transaction to this address exists.
 */
const hasPendingGeth = (conf: any, txRequest: any, opts: PendingOpts): Promise<boolean> => {
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

          for (const account of Object.keys(res.result.pending)) {
            for (const nonce in res.result.pending[account]) {
              if (res.result.pending[account][nonce].to === txRequest.address) {
                const withValidGasPrice =
                  res.result.pending[account][nonce] &&
                  (!opts.checkGasPrice ||
                    (await hasValidGasPrice(
                      conf,
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
 * Uses the Geth specific RPC request `txpool_content` to search
 * for pending transactions in the transaction pool.
 * @param {Config} conf Config object.
 * @param {TransactionReceipt} transaction Ethereum transaction receipt
 * @param {number} minPrice (optional) Expected gasPrice.
 * @returns {Promise<boolean>} Transaction, if a pending transaction to this address exists.
 */
const hasValidGasPrice = async (conf: any, transaction: any, minPrice?: any) => {
  if (minPrice) {
    return minPrice.valueOf() === transaction.gasPrice.valueOf();
  }
  const spread = 0.3;
  let currentGasPrice: number;
  await new Promise((resolve, reject) => {
    conf.web3.eth.getGasPrice((err: Error, res: any) => {
      if (err) {
        conf.logger.error(err);
        return;
      }
      currentGasPrice = res;
      resolve(true);
    });
  });
  return currentGasPrice && spread * currentGasPrice.valueOf() <= transaction.gasPrice.valueOf();
};

/**
 * Uses the Geth specific RPC request `txpool_content` to search
 * for pending transactions in the transaction pool.
 * @param {TransactionReceipt} transaction Ethereum transaction receipt
 * @param {string} type Type of pending request: claim,execute.
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const isOfType = (transaction: any, type?: string) => {
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
 */
const hasPending = async (conf: any, txRequest: any, opts: PendingOpts): Promise<boolean> => {
  let result = false;

  if (conf.client === 'parity') {
    result = await hasPendingParity(conf, txRequest, opts);
  } else if (conf.client === 'geth') {
    result = await hasPendingGeth(conf, txRequest, opts);
  }

  conf.logger.debug(` ${txRequest.address} hasPending=${result}`);

  return result;
};

export default hasPending;
