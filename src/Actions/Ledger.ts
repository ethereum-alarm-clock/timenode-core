import BigNumber from 'bignumber.js';

import { IStatsDB } from '../Stats/StatsDB';
import { ITxRequest } from '../Types';
import ITransactionOptions from '../Types/ITransactionOptions';
import { isTransactionStatusSuccessful } from './Helpers';

export interface ILedger {
  accountClaiming(receipt: any, txRequest: ITxRequest, opts: any, from: string): boolean;
  accountExecution(
    txRequest: ITxRequest,
    receipt: any,
    opts: ITransactionOptions,
    from: string,
    success: boolean,
    paymentModifier: BigNumber
  ): boolean;
}

export class Ledger implements ILedger {
  private statsDB: IStatsDB;

  constructor(statsDB: IStatsDB) {
    this.statsDB = statsDB;
  }

  public accountClaiming(
    receipt: any,
    txRequest: ITxRequest,
    opts: ITransactionOptions,
    from: string
  ): boolean {
    if (!receipt) {
      return false;
    }

    const gasUsed = new BigNumber(receipt.gasUsed);
    const gasPrice = new BigNumber(opts.gasPrice);
    const success = isTransactionStatusSuccessful(receipt.status);
    let txCost = gasUsed.mul(gasPrice);
    if (success) {
      txCost = txCost.add(txRequest.requiredDeposit);
    }

    this.statsDB.claimed(from, txRequest.address, txCost, success);

    return true;
  }

  public accountExecution(
    txRequest: ITxRequest,
    receipt: any,
    opts: ITransactionOptions,
    from: string,
    success: boolean,
    paymentModifier: BigNumber
  ): boolean {
    let bounty = new BigNumber(0);
    let cost = new BigNumber(0);

    const gasUsed = new BigNumber(receipt.gasUsed);
    const minimumGasPrice = new BigNumber(opts.gasPrice);

    if (success) {
      const data = receipt.logs[0].data;
      bounty = new BigNumber(data.slice(0, 66));

      const actualGasPrice = new BigNumber(`0x${data.slice(66, 130)}`);
      const totalBounty = bounty.mul(paymentModifier);
      const totalMinimumCost = gasUsed.mul(minimumGasPrice);
      const totalReimbursedCost = actualGasPrice.mul(gasUsed);

      cost = totalBounty.add(totalMinimumCost).sub(totalReimbursedCost);
    } else {
      cost = gasUsed.mul(minimumGasPrice);
    }

    this.statsDB.executed(from, txRequest.address, cost, bounty, success);

    return true;
  }
}
