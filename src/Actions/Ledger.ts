import BigNumber from 'bignumber.js';

import { IStatsDB } from '../Stats/StatsDB';
import ITransactionOptions from '../Types/ITransactionOptions';
import { isTransactionStatusSuccessful } from './Helpers';
import { TransactionReceipt } from 'web3/types';
import { ITransactionRequest } from '@ethereum-alarm-clock/lib';

export interface ILedger {
  accountClaiming(
    receipt: TransactionReceipt,
    txRequest: ITransactionRequest,
    opts: any,
    from: string
  ): boolean;
  accountExecution(
    txRequest: ITransactionRequest,
    receipt: TransactionReceipt,
    opts: ITransactionOptions,
    from: string,
    success: boolean
  ): boolean;
}

export class Ledger implements ILedger {
  private statsDB: IStatsDB;

  constructor(statsDB: IStatsDB) {
    this.statsDB = statsDB;
  }

  public accountClaiming(
    receipt: TransactionReceipt,
    txRequest: ITransactionRequest,
    opts: ITransactionOptions,
    from: string
  ): boolean {
    if (!receipt) {
      return false;
    }

    const gasUsed = new BigNumber(receipt.gasUsed);
    const gasPrice = new BigNumber(opts.gasPrice);
    const success = isTransactionStatusSuccessful(receipt.status);
    let txCost = gasUsed.multipliedBy(gasPrice);
    if (success) {
      txCost = txCost.plus(txRequest.requiredDeposit);
    }

    this.statsDB.claimed(from, txRequest.address, txCost, success);

    return true;
  }

  public accountExecution(
    txRequest: ITransactionRequest,
    receipt: TransactionReceipt,
    opts: ITransactionOptions,
    from: string,
    success: boolean
  ): boolean {
    let bounty = new BigNumber(0);
    let cost = new BigNumber(0);

    const gasUsed = new BigNumber(receipt.gasUsed);
    const actualGasPrice = opts.gasPrice;

    if (success) {
      const data = receipt.logs[0].data;
      bounty = new BigNumber(data.slice(0, 66)).minus(gasUsed.multipliedBy(actualGasPrice));
    } else {
      cost = gasUsed.multipliedBy(actualGasPrice);
    }

    this.statsDB.executed(from, txRequest.address, cost, bounty, success);

    return true;
  }
}
