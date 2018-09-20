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
   *
   *
   * @param {ITxRequestPending} txRequest Transaction Request object to check.
   * @param {PendingOpts} opts Options for pending check
   * @returns {Promise<boolean>} True if a pending transaction to this address exists.
   * @memberof Pending
   */
  public async hasPending(txRequest: ITxRequestPending, opts: PendingOpts): Promise<boolean> {
    let result: boolean = false;
    if (this.txPool.running()) {
      result = await this.hasPendingPool(txRequest, opts);
    }
    return result;
  }

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

  private isOfType(transaction: ITxPoolTxDetails, type?: string) {
    if (transaction && !type) {
      return true;
    }
    return transaction.input === FnSignatures[type];
  }

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
