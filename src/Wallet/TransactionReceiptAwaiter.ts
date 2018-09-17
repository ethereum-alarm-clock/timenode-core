import { ITransactionReceipt } from '../Types/ITransactionReceipt';
const awaitTransactionMined = require('await-transaction-mined');

const POLL_INTERVAL = 5000;

export interface ITransactionReceiptAwaiter {
  waitForConfirmations(hash: string): Promise<ITransactionReceipt>;
}

export class TransactionReceiptAwaiter implements ITransactionReceiptAwaiter {
  private web3: any;

  public constructor(web3: any) {
    this.web3 = web3;
  }

  public async waitForConfirmations(hash: string): Promise<ITransactionReceipt> {
    return awaitTransactionMined.awaitTx(this.web3, hash, {
      ensureNotUncle: true,
      interval: POLL_INTERVAL
    });
  }
}
