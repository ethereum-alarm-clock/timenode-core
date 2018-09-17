import BigNumber from 'bignumber.js';

import { FnSignatures } from '../Enum';
import { ILogger, DefaultLogger } from '../Logger';
import TxPool, { ITxPoolTxDetails } from '../TxPool';
import { ITxRequestPending } from '../Types/ITxRequest';
import W3Util from '../Util';

interface PendingOpts {
  type?: string;
  checkGasPrice: boolean;
  minPrice?: BigNumber;
}

export class Pending {
  private util: W3Util;
  private txPool: any;
  private logger: ILogger;

  constructor(util: W3Util, txPool: TxPool, logger: ILogger = new DefaultLogger()) {
    this.util = util;
    this.txPool = txPool;
    this.logger = logger;
  }

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
  public async hasPending(txRequest: ITxRequestPending, opts: PendingOpts): Promise<boolean> {
    let result: boolean = false;
    if (this.txPool.running()) {
      result = await this.hasPendingPool(txRequest, opts);
    }
    return result;
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
  private async hasPendingPool(txRequest: ITxRequestPending, opts: PendingOpts): Promise<boolean> {
    let validPending: (boolean | ITxPoolTxDetails)[] = [];

    try {
      const currentGasPrice: BigNumber = await this.util.networkGasPrice();
      validPending = this.txPool.pool
        .get(txRequest.address, 'to')
        .filter((tx: ITxPoolTxDetails) => {
          const withValidGasPrice =
            !opts.checkGasPrice || this.hasValidGasPrice(currentGasPrice, tx, opts.minPrice);
          return this.isOfType(tx, opts.type) && withValidGasPrice;
        });
      return validPending.length > 0;
    } catch (e) {
      this.logger.info(e);
    }

    return true; //if there is an error, assume tq exists so we don't loose
  }

  /**
   * Uses the Geth specific RPC request `txpool_content` to search
   * for pending transactions in the transaction pool.
   * @param {TransactionReceipt} transaction Ethereum transaction receipt
   * @param {string} type Type of pending request: claim,execute.
   * @returns {Promise<boolean>} True if a pending transaction to this address exists.
   */
  private isOfType(transaction: ITxPoolTxDetails, type?: string) {
    if (transaction && !type) {
      return true;
    }
    return transaction.input === FnSignatures[type];
  }

  /**
   * Checks that pending transactions in the transaction pool have valid gasPrices.
   * @param {Config} conf Config object.
   * @param {TransactionReceipt} transaction Ethereum transaction receipt
   * @param {number} minPrice (optional) Expected gasPrice.
   * @returns {Promise<boolean>} Transaction, if a pending transaction to this address exists.
   */
  private hasValidGasPrice(
    networkPrice: BigNumber,
    transaction: ITxPoolTxDetails,
    minPrice?: BigNumber
  ) {
    const spread = 0.3;
    const hasMinPrice: boolean = !minPrice || minPrice.lte(transaction.gasPrice);
    return (
      hasMinPrice && networkPrice && networkPrice.times(spread).lte(transaction.gasPrice.valueOf())
    );
  }
}
