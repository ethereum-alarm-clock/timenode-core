import BigNumber from 'bignumber.js';

import Cache, { ICachedTxDetails } from '../Cache';
import { ILogger } from '../Logger';
import { Address } from '../Types';
import ITransactionOptions from '../Types/ITransactionOptions';
import { IWalletReceipt, Wallet } from '../Wallet';
import { getAbortedExecuteStatus, isAborted, isExecuted } from './Helpers';
import { ILedger } from './Ledger';
import { Pending } from './Pending';
import { Operation } from '../Types/Operation';
import { TxSendStatus } from '../Enum/TxSendStatus';
import { Util, ITransactionRequest } from '@ethereum-alarm-clock/lib';

export default interface IActions {
  claim(
    txRequest: ITransactionRequest,
    nextAccount: Address,
    gasPrice: BigNumber
  ): Promise<TxSendStatus>;
  execute(txRequest: ITransactionRequest, gasPrice: BigNumber): Promise<TxSendStatus>;
}

export default class Actions implements IActions {
  private logger: ILogger;
  private wallet: Wallet;
  private ledger: ILedger;
  private cache: Cache<ICachedTxDetails>;
  private util: Util;
  private pending: Pending;

  constructor(
    wallet: Wallet,
    ledger: ILedger,
    logger: ILogger,
    cache: Cache<ICachedTxDetails>,
    util: Util,
    pending: Pending
  ) {
    this.wallet = wallet;
    this.logger = logger;
    this.ledger = ledger;
    this.cache = cache;
    this.util = util;
    this.pending = pending;
  }

  public async claim(
    txRequest: ITransactionRequest,
    nextAccount: Address,
    gasPrice: BigNumber
  ): Promise<TxSendStatus> {
    const context = TxSendStatus.claim;
    //TODO: merge wallet ifs into 1 getWalletStatus or something
    if (this.wallet.hasPendingTransaction(txRequest.address, Operation.CLAIM)) {
      return TxSendStatus.STATUS(TxSendStatus.PROGRESS, context);
    }
    if (!this.wallet.isAccountAbleToSendTx(nextAccount)) {
      return TxSendStatus.STATUS(TxSendStatus.BUSY, context);
    }
    if (await this.pending.hasPending(txRequest, { type: Operation.CLAIM, checkGasPrice: true })) {
      return TxSendStatus.STATUS(TxSendStatus.PENDING, context);
    }

    const opts = this.getClaimingOpts(txRequest, gasPrice);
    const { receipt, from, status } = await this.wallet.sendFromAccount(nextAccount, opts);

    this.ledger.accountClaiming(receipt, txRequest, opts, from);

    if (status === TxSendStatus.OK) {
      this.cache.get(txRequest.address).claimedBy = from;
      return TxSendStatus.STATUS(TxSendStatus.SUCCESS, context);
    } else if (status === TxSendStatus.UNKNOWN_ERROR) {
      this.logger.error(status);
      return TxSendStatus.STATUS(TxSendStatus.FAIL, context);
    } else {
      return TxSendStatus.STATUS(status, context);
    }
  }

  public async execute(txRequest: ITransactionRequest, gasPrice: BigNumber): Promise<TxSendStatus> {
    const context = TxSendStatus.execute;
    if (this.wallet.hasPendingTransaction(txRequest.address, Operation.EXECUTE)) {
      return TxSendStatus.STATUS(TxSendStatus.PROGRESS, context);
    }
    if (!this.wallet.isNextAccountFree()) {
      return TxSendStatus.STATUS(TxSendStatus.BUSY, context);
    }

    const opts = this.getExecutionOpts(txRequest, gasPrice);
    const claimIndex = this.wallet.getAddresses().indexOf(txRequest.claimedBy);
    const wasClaimedByOurNode = claimIndex > -1;
    let executionResult: IWalletReceipt;

    if (wasClaimedByOurNode && txRequest.inReservedWindow()) {
      this.logger.debug(
        `Claimed by our node ${claimIndex} and inReservedWindow`,
        txRequest.address
      );
      executionResult = await this.wallet.sendFromIndex(claimIndex, opts);
    } else if (!(await this.hasPendingExecuteTransaction(txRequest))) {
      executionResult = await this.wallet.sendFromNext(opts);
    } else {
      return TxSendStatus.STATUS(TxSendStatus.PENDING, context);
    }

    const { receipt, from, status } = executionResult;

    if (status === TxSendStatus.OK) {
      await txRequest.refreshData();
      let executionStatus = TxSendStatus.STATUS(TxSendStatus.SUCCESS, context);
      const success = isExecuted(receipt);

      if (success) {
        this.cache.get(txRequest.address).wasCalled = true;
      } else if (isAborted(receipt)) {
        executionStatus = getAbortedExecuteStatus(receipt);
      } else {
        executionStatus = TxSendStatus.STATUS(TxSendStatus.FAIL, context);
      }

      this.ledger.accountExecution(txRequest, receipt, opts, from, success);

      return executionStatus;
    } else if (status === TxSendStatus.UNKNOWN_ERROR) {
      this.logger.error(status, txRequest.address);
    } else {
      return TxSendStatus.STATUS(status, context);
    }

    return TxSendStatus.STATUS(TxSendStatus.FAIL, context);
  }

  public async cleanup(): Promise<boolean> {
    throw Error('Not implemented according to latest EAC changes.');
  }

  private async hasPendingExecuteTransaction(txRequest: ITransactionRequest): Promise<boolean> {
    return this.pending.hasPending(txRequest, {
      type: Operation.EXECUTE,
      checkGasPrice: true,
      minPrice: txRequest.gasPrice
    });
  }

  private getClaimingOpts(
    txRequest: ITransactionRequest,
    gasPrice: BigNumber
  ): ITransactionOptions {
    return {
      to: txRequest.address,
      value: txRequest.requiredDeposit,
      gas: new BigNumber('120000'),
      gasPrice,
      data: txRequest.claimData,
      operation: Operation.CLAIM
    };
  }

  private getExecutionOpts(
    txRequest: ITransactionRequest,
    gasPrice: BigNumber
  ): ITransactionOptions {
    const gas = this.util.calculateGasAmount(txRequest);

    return {
      to: txRequest.address,
      value: new BigNumber(0),
      gas,
      gasPrice,
      data: txRequest.executeData,
      operation: Operation.EXECUTE
    };
  }
}
