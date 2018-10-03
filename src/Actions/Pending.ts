import BigNumber from 'bignumber.js';

import { ILogger, DefaultLogger } from '../Logger';
import { ITxRequestPending } from '../Types/ITxRequest';
import W3Util from '../Util';
import { Operation } from '../Types/Operation';
import { ITxPool, ITxPoolTxDetails } from '../TxPool';

interface PendingOpts {
  type: Operation;
  checkGasPrice: boolean;
  minPrice?: BigNumber;
}

export class Pending {
  private util: W3Util;
  private txPool: ITxPool;
  private logger: ILogger;

  constructor(util: W3Util, txPool: ITxPool, logger: ILogger = new DefaultLogger()) {
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
    return this.txPool.running() ? await this.hasPendingPool(txRequest, opts) : false;
  }

  private async hasPendingPool(txRequest: ITxRequestPending, opts: PendingOpts): Promise<boolean> {
    try {
      const currentGasPrice = await this.util.networkGasPrice();
      return Array.from(this.txPool.pool.values()).some(poolTx => {
        const hasCorrectAddress = poolTx.to === txRequest.address;
        const withValidGasPrice =
          !opts.checkGasPrice || this.hasValidGasPrice(currentGasPrice, poolTx, opts.minPrice);
        const hasCorrectOperation = poolTx.operation === opts.type;

        return hasCorrectAddress && withValidGasPrice && hasCorrectOperation;
      });
    } catch (e) {
      this.logger.info(e);
    }

    return true; //if there is an error, assume tq exists so we don't loose
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
