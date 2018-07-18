import { FnSignatures } from '../Enum';

/**
 * Uses the Parity specific RPC request `parity_pendingTransactions` to search
 * for pending transactions in the transaction pool.
 * @param {TransactionRequest} txRequest
 * @param {string} type (optional) Type of pending request: claim,execute.
 * @param {boolean} checkGasPrice (optional, default: true) Check if transaction's gasPrice is sufficient for Network.
 * @param {number} exactPrice (optional) Expected gasPrice.
 * @returns {Promise<boolean>} True if a pending transaction to this address exists.
 */
const hasPendingParity = async (
  conf: any,
  txRequest: any,
  opts: { type?: string; checkGasPrice?: boolean; exactPrice?: any }
) => {
  opts.checkGasPrice = opts.checkGasPrice === undefined ? true : opts.checkGasPrice;
  const provider = conf.web3.currentProvider;

  return new Promise((resolve, reject) => {
    provider.sendAsync(
      {
        jsonrpc: '2.0',
        method: 'parity_pendingTransactions',
        params: [],
        id: 0o7
      },
      async (err: Error, res: any) => {
        if (err) {
          reject(err);
        }

        for (const count of Object.keys(res.result)) {
          if (res.result[count].to === txRequest.address) {
            const withValidGasPrice =
              res.result[count] &&
              (!opts.checkGasPrice ||
                (await hasValidGasPrice(conf.web3, res.result[count], opts.exactPrice)));
            if (res.result[count] && isOfType(res.result[count], opts.type) && withValidGasPrice) {
              resolve(true);
            }
          }
        }
        resolve(false);
      }
    );
  });
};

/**
 * Uses the Geth specific RPC request `txpool_content` to search
 * for pending transactions in the transaction pool.
 * @param {TransactionRequest} txRequest
 * @param {string} type (optional) Type of pending request: claim,execute.
 * @param {boolean} checkGasPrice (optional, default: true) Check if transaction's gasPrice is sufficient for Network.
 * @param {number} exactPrice (optional) Expected gasPrice.
 * @returns {Promise<object>} Transaction, if a pending transaction to this address exists.
 */
const hasPendingGeth = (
  conf: any,
  txRequest: any,
  opts: { type?: string; checkGasPrice?: boolean; exactPrice?: any }
) => {
  opts.checkGasPrice = opts.checkGasPrice === undefined ? true : opts.checkGasPrice;
  const provider = conf.web3.currentProvider;

  return new Promise((resolve, reject) => {
    provider.send(
      {
        jsonrpc: '2.0',
        method: 'txpool_content',
        params: [],
        id: 0o7
      },
      async (err: Error, res: any) => {
        if (err) {
          reject(err);
        }

        for (const account of Object.keys(res.result.pending)) {
          for (const nonce in res.result.pending[account]) {
            if (res.result.pending[account][nonce].to === txRequest.address) {
              const withValidGasPrice =
                res.result.pending[account][nonce] &&
                (!opts.checkGasPrice ||
                  (await hasValidGasPrice(
                    conf.web3,
                    res.result.pending[account][nonce],
                    opts.exactPrice
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
  });
};

/**
 * Uses the Geth specific RPC request `txpool_content` to search
 * for pending transactions in the transaction pool.
 * @param {Web3} web3 the Web3 instance to use
 * @param {TransactionReceipt} transaction Ethereum transaction receipt
 * @param {number} exactPrice (optional) Expected gasPrice.
 * @returns {Promise<boolean>} Transaction, if a pending transaction to this address exists.
 */
const hasValidGasPrice = async (web3: any, transaction: any, exactPrice?: any) => {
  if (exactPrice) {
    return exactPrice.valueOf() === transaction.gasPrice.valueOf();
  }
  const spread = 0.3;
  let currentGasPrice: number;
  await new Promise((resolve, reject) => {
    web3.eth.getGasPrice((err: Error, res: any) => {
      if (err) {
        reject(err);
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
 * @param {number} exactPrice (optional) Expected gasPrice to compare.
 */
const hasPending = (
  conf: any,
  txRequest: any,
  opts: { type?: string; checkGasPrice?: boolean; exactPrice?: any }
) => {
  if (conf.client === 'parity') {
    return hasPendingParity(conf, txRequest, opts);
  }

  if (conf.client === 'geth') {
    return hasPendingGeth(conf, txRequest, opts);
  }
};

export default hasPending;
