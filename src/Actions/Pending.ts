import BigNumber from 'bignumber.js';
import { Operation } from '../Types/Operation';
import { ITxPool, ITxPoolTxDetails } from '../TxPool';
import { ITransactionRequestPending } from '@ethereum-alarm-clock/lib/built/transactionRequest/ITransactionRequest';
import { GasPriceUtil } from '@ethereum-alarm-clock/lib';

interface PendingOpts {
  type: Operation;
  checkGasPrice: boolean;
  minPrice?: BigNumber;
}

const NETWORK_GAS_PRICE_RATIO = 0.3;

export class Pending {
  private gasPriceUtil: GasPriceUtil;
  private txPool: ITxPool;

  constructor(gasPriceUtil: GasPriceUtil, txPool: ITxPool) {
    this.gasPriceUtil = gasPriceUtil;
    this.txPool = txPool;
  }

  /**
   *
   *
   * @param {ITransactionRequestPending} txRequest Transaction Request object to check.
   * @param {PendingOpts} opts Options for pending check
   * @returns {Promise<boolean>} True if a pending transaction to this address exists.
   * @memberof Pending
   */
  public async hasPending(
    txRequest: ITransactionRequestPending,
    opts: PendingOpts
  ): Promise<boolean> {
    return this.txPool.running() ? this.hasPendingPool(txRequest, opts) : false;
  }

  private async hasPendingPool(
    txRequest: ITransactionRequestPending,
    opts: PendingOpts
  ): Promise<boolean> {
    const currentGasPrice = await this.gasPriceUtil.networkGasPrice();
    return Array.from(this.txPool.pool.values()).some(poolTx => {
      const hasCorrectAddress = poolTx.to === txRequest.address;
      const withValidGasPrice =
        !opts.checkGasPrice || this.hasValidGasPrice(currentGasPrice, poolTx, opts.minPrice);
      const hasCorrectOperation = poolTx.operation === opts.type;

      return hasCorrectAddress && withValidGasPrice && hasCorrectOperation;
    });
  }

  private hasValidGasPrice(
    networkPrice: BigNumber,
    transaction: ITxPoolTxDetails,
    minPrice?: BigNumber
  ) {
    const hasMinPrice: boolean = !minPrice || minPrice.lte(transaction.gasPrice);
    return (
      hasMinPrice &&
      networkPrice &&
      networkPrice.times(NETWORK_GAS_PRICE_RATIO).lte(transaction.gasPrice.valueOf())
    );
  }
}
