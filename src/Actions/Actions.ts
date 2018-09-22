import BigNumber from 'bignumber.js';

import Cache, { ICachedTxDetails } from '../Cache';
import { IEconomicStrategyManager } from '../EconomicStrategy/EconomicStrategyManager';
import { ClaimStatus, ExecuteStatus } from '../Enum';
import { TxSendErrors } from '../Enum/TxSendErrors';
import { ILogger } from '../Logger';
import { Address, ITxRequest } from '../Types';
import ITransactionOptions from '../Types/ITransactionOptions';
import W3Util from '../Util';
import { IWalletReceipt, Wallet } from '../Wallet';
import { getAbortedExecuteStatus, isAborted, isExecuted } from './Helpers';
import { ILedger } from './Ledger';
import { Pending } from './Pending';
import { Operation } from '../Types/Operation';

export default interface IActions {
  claim(txRequest: ITxRequest, nextAccount: Address): Promise<ClaimStatus>;
  execute(txRequest: ITxRequest): Promise<ExecuteStatus>;
}

export default class Actions implements IActions {
  private logger: ILogger;
  private wallet: Wallet;
  private ledger: ILedger;
  private cache: Cache<ICachedTxDetails>;
  private utils: W3Util;
  private pending: Pending;
  private economicStrategyManager: IEconomicStrategyManager;

  constructor(
    wallet: Wallet,
    ledger: ILedger,
    logger: ILogger,
    cache: Cache<ICachedTxDetails>,
    utils: W3Util,
    pending: Pending,
    economicStrategyManager: IEconomicStrategyManager
  ) {
    this.wallet = wallet;
    this.logger = logger;
    this.ledger = ledger;
    this.cache = cache;
    this.utils = utils;
    this.pending = pending;
    this.economicStrategyManager = economicStrategyManager;
  }

  public async claim(txRequest: ITxRequest, nextAccount: Address): Promise<ClaimStatus> {
    //TODO: merge wallet ifs into 1 getWalletStatus or something
    if (this.wallet.hasPendingTransaction(txRequest.address, Operation.CLAIM)) {
      return ClaimStatus.IN_PROGRESS;
    }
    if (!this.wallet.isAccountAbleToSendTx(nextAccount)) {
      return ClaimStatus.ACCOUNT_BUSY;
    }
    if (await this.pending.hasPending(txRequest, { type: 'claim', checkGasPrice: true })) {
      return ClaimStatus.PENDING;
    }

    try {
      const opts = await this.getClaimingOpts(txRequest);
      const { receipt, from, status } = await this.wallet.sendFromAccount(nextAccount, opts);
      await this.ledger.accountClaiming(receipt, txRequest, opts, from);

      switch (status) {
        case TxSendErrors.OK:
          this.cache.get(txRequest.address).claimedBy = from;
          return ClaimStatus.SUCCESS;
        case TxSendErrors.WALLET_BUSY:
          return ClaimStatus.ACCOUNT_BUSY;
        case TxSendErrors.IN_PROGRESS:
          return ClaimStatus.IN_PROGRESS;
        case TxSendErrors.MINED_IN_UNCLE:
          return ClaimStatus.MINED_IN_UNCLE;
      }
    } catch (err) {
      this.logger.error(err);
    }

    return ClaimStatus.FAILED;
  }

  public async execute(txRequest: ITxRequest): Promise<ExecuteStatus> {
    if (this.wallet.hasPendingTransaction(txRequest.address, Operation.EXECUTE)) {
      return ExecuteStatus.IN_PROGRESS;
    }
    if (!(await this.wallet.isNextAccountFree())) {
      return ExecuteStatus.WALLET_BUSY;
    }

    try {
      const opts = await this.getExecutionOpts(txRequest);
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
        return ExecuteStatus.PENDING;
      }

      const { receipt, from, status } = executionResult;

      switch (status) {
        case TxSendErrors.OK:
          await txRequest.refreshData();

          let executionStatus = ExecuteStatus.SUCCESS;
          const success = isExecuted(receipt);

          if (success) {
            this.cache.get(txRequest.address).wasCalled = true;
          } else if (isAborted(receipt)) {
            executionStatus = getAbortedExecuteStatus(receipt);
          } else {
            executionStatus = ExecuteStatus.FAILED;
          }

          this.ledger.accountExecution(txRequest, receipt, opts, from, success);

          return executionStatus;
        case TxSendErrors.WALLET_BUSY:
          return ExecuteStatus.WALLET_BUSY;
        case TxSendErrors.IN_PROGRESS:
          return ExecuteStatus.IN_PROGRESS;
        case TxSendErrors.MINED_IN_UNCLE:
          return ExecuteStatus.MINED_IN_UNCLE;
      }
    } catch (err) {
      this.logger.error(err, txRequest.address);
    }

    return ExecuteStatus.FAILED;
  }

  public async cleanup(): Promise<boolean> {
    throw Error('Not implemented according to latest EAC changes.');
  }

  private async hasPendingExecuteTransaction(txRequest: ITxRequest): Promise<boolean> {
    return this.pending.hasPending(txRequest, {
      type: 'execute',
      checkGasPrice: true,
      minPrice: txRequest.gasPrice
    });
  }

  private async getClaimingOpts(txRequest: ITxRequest): Promise<ITransactionOptions> {
    return {
      to: txRequest.address,
      value: txRequest.requiredDeposit,
      gas: 120000,
      gasPrice: await this.utils.networkGasPrice(),
      data: txRequest.claimData,
      operation: Operation.CLAIM
    };
  }

  private async getExecutionOpts(txRequest: ITxRequest): Promise<ITransactionOptions> {
    const gas = this.utils.calculateGasAmount(txRequest);
    const gasPrice = await this.economicStrategyManager.getExecutionGasPrice(txRequest);

    return {
      to: txRequest.address,
      value: new BigNumber(0),
      gas: gas.toNumber(),
      gasPrice,
      data: txRequest.executeData,
      operation: Operation.EXECUTE
    };
  }
}
