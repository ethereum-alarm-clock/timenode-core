import { ITransactionReceipt } from '../Types/ITransactionReceipt';
import { W3Util } from '..';

const POLL_INTERVAL = 5000;

export interface ITransactionReceiptAwaiter {
  waitForConfirmations(hash: string): Promise<ITransactionReceipt>;
}

export class TransactionReceiptAwaiter implements ITransactionReceiptAwaiter {
  private util: W3Util;

  public constructor(util: W3Util) {
    this.util = util;
  }

  public async waitForConfirmations(hash: string): Promise<ITransactionReceipt> {
    return await this.awaitTx(hash, {
      ensureNotUncle: true,
      interval: POLL_INTERVAL
    });
  }

  private awaitTx(hash: string, options: any): Promise<ITransactionReceipt> {
    const interval = options && options.interval ? options.interval : 500;
    const transactionReceiptAsync = async (txnHash: string, resolve: any, reject: any) => {
      try {
        const receipt = this.util.getReceipt(txnHash);
        if (!receipt) {
          setTimeout(() => {
            transactionReceiptAsync(txnHash, resolve, reject);
          }, interval);
        } else {
          if (options && options.ensureNotUncle) {
            const resolvedReceipt = await receipt;
            if (!resolvedReceipt || !resolvedReceipt.blockNumber) {
              setTimeout(() => {
                transactionReceiptAsync(txnHash, resolve, reject);
              }, interval);
            } else {
              try {
                const block = await this.util.getBlock(resolvedReceipt.blockNumber);
                const current = await this.util.getBlock('latest');
                if (current.number - block.number >= 12) {
                  const txn = await this.util.getTransaction(txnHash);
                  if (txn.blockNumber != null) {
                    resolve(resolvedReceipt);
                  } else {
                    reject(
                      new Error(
                        'Transaction with hash: ' + txnHash + ' ended up in an uncle block.'
                      )
                    );
                  }
                } else {
                  setTimeout(() => {
                    transactionReceiptAsync(txnHash, resolve, reject);
                  }, interval);
                }
              } catch (e) {
                setTimeout(() => {
                  transactionReceiptAsync(txnHash, resolve, reject);
                }, interval);
              }
            }
          } else {
            resolve(receipt);
          }
        }
      } catch (e) {
        reject(e);
      }
    };

    return new Promise((resolve, reject) => {
      transactionReceiptAsync(hash, resolve, reject);
    });
  }
}
