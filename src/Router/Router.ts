import Actions from '../Actions';
import Config from '../Config';
import { TxStatus, ClaimStatus, ExecuteStatus } from '../Enum';
import { shouldClaimTx, shouldExecuteTx } from '../EconomicStrategy';

import W3Util from '../Util';
import { Address, ITxRequest } from '../Types';

export default class Router {
  public actions: Actions;
  public config: Config;
  public util: W3Util;
  public txRequestStates: object = {};

  public transitions: object = {};

  constructor(config: Config, actions: any) {
    this.actions = actions;
    this.config = config;
    this.util = config.util;

    this.transitions[TxStatus.BeforeClaimWindow] = this.beforeClaimWindow.bind(this);
    this.transitions[TxStatus.ClaimWindow] = this.claimWindow.bind(this);
    this.transitions[TxStatus.FreezePeriod] = this.freezePeriod.bind(this);
    this.transitions[TxStatus.ExecutionWindow] = this.executionWindow.bind(this);
    this.transitions[TxStatus.Executed] = this.executed.bind(this);
    this.transitions[TxStatus.Missed] = this.missed.bind(this);
    this.transitions[TxStatus.Done] = (txRequest: ITxRequest) => {
      this.config.logger.info('Finished. Deleting from cache...', txRequest.address);
      this.config.cache.del(txRequest.address);
      return TxStatus.Done;
    };
  }

  public async beforeClaimWindow(txRequest: ITxRequest): Promise<TxStatus> {
    if (txRequest.isCancelled) {
      // TODO Status.CleanUp?
      return TxStatus.Executed;
    }

    if (await txRequest.beforeClaimWindow()) {
      return TxStatus.BeforeClaimWindow;
    }

    return TxStatus.ClaimWindow;
  }

  public async claimWindow(txRequest: ITxRequest): Promise<TxStatus> {
    if (!(await txRequest.inClaimWindow()) || txRequest.isClaimed) {
      return TxStatus.FreezePeriod;
    }

    if (this.config.claiming) {
      const nextAccount: Address = this.config.wallet.nextAccount.getAddressString();
      const shouldClaim: boolean = await shouldClaimTx(txRequest, this.config, nextAccount);

      if (shouldClaim) {
        try {
          const claimingStatus: ClaimStatus = await this.actions.claim(txRequest, nextAccount);

          this.handleWalletTransactionResult(claimingStatus, txRequest);

          if (claimingStatus === ClaimStatus.SUCCESS || claimingStatus === ClaimStatus.FAILED) {
            return TxStatus.FreezePeriod;
          }
        } catch (err) {
          this.config.logger.error(err, txRequest.address);
          throw new Error(err);
        }
      } else {
        this.config.logger.info('Not profitable to claim.', txRequest.address);
        this.config.logger.debug(
          `ECONOMIC STRATEGY: ${JSON.stringify(this.config.economicStrategy)}`
        );
      }
    }

    return TxStatus.ClaimWindow;
  }

  public async freezePeriod(txRequest: ITxRequest): Promise<TxStatus> {
    if (await txRequest.inFreezePeriod()) {
      return TxStatus.FreezePeriod;
    }

    if (await txRequest.inExecutionWindow()) {
      return TxStatus.ExecutionWindow;
    }

    return TxStatus.FreezePeriod;
  }

  public async inReservedWindowAndNotClaimedLocally(txRequest: ITxRequest): Promise<boolean> {
    const inReserved = await txRequest.inReservedWindow();
    return inReserved && txRequest.isClaimed && !this.isLocalClaim(txRequest);
  }

  public async executionWindow(txRequest: ITxRequest): Promise<TxStatus> {
    if (txRequest.wasCalled) {
      return TxStatus.Executed;
    }
    if (await this.isTransactionMissed(txRequest)) {
      return TxStatus.Missed;
    }

    if (await this.inReservedWindowAndNotClaimedLocally(txRequest)) {
      return TxStatus.ExecutionWindow;
    }

    const shouldExecute = await shouldExecuteTx(txRequest, this.config);

    if (shouldExecute) {
      try {
        const executionStatus: ExecuteStatus = await this.actions.execute(txRequest);

        this.handleWalletTransactionResult(executionStatus, txRequest);

        if (executionStatus === ExecuteStatus.SUCCESS) {
          return TxStatus.Executed;
        }
      } catch (err) {
        this.config.logger.error(err, txRequest.address);
        throw new Error(err);
      }
    } else {
      this.config.logger.info('Not profitable to execute. Gas price too high.', txRequest.address);
    }

    return TxStatus.ExecutionWindow;
  }

  public async executed(): Promise<TxStatus> {
    /**
     * We don't cleanup because cleanup needs refactor according to latest logic in EAC
     * https://github.com/ethereum-alarm-clock/ethereum-alarm-clock/blob/master/contracts/Library/RequestLib.sol#L433
     *
     * await this.actions.cleanup(txRequest);
     */
    //

    return TxStatus.Done;
  }

  public async missed(): Promise<TxStatus> {
    // TODO cleanup
    return TxStatus.Done;
  }

  public async isTransactionMissed(txRequest: ITxRequest): Promise<boolean> {
    const now = await txRequest.now();
    const afterExecutionWindow = txRequest.executionWindowEnd.lessThanOrEqualTo(now);

    return afterExecutionWindow && !txRequest.wasCalled;
  }

  public isLocalClaim(txRequest: ITxRequest): boolean {
    const localClaim = this.config.wallet.isKnownAddress(txRequest.claimedBy);

    if (!localClaim) {
      this.config.logger.debug(
        `In reserve window and not claimed by this TimeNode.`,
        txRequest.address
      );
    }

    return localClaim;
  }

  public async route(txRequest: ITxRequest): Promise<any> {
    let status: TxStatus = this.txRequestStates[txRequest.address] || TxStatus.BeforeClaimWindow;

    const statusFunction = this.transitions[status];
    let nextStatus: TxStatus = await statusFunction(txRequest);

    while (nextStatus !== status) {
      this.config.logger.debug(
        `Transitioning from ${TxStatus[status]} to ${TxStatus[nextStatus]} (${nextStatus})`,
        txRequest.address
      );
      status = nextStatus;
      nextStatus = await this.transitions[status](txRequest);
    }

    this.txRequestStates[txRequest.address] = nextStatus;
    return nextStatus;
  }

  private handleWalletTransactionResult(
    status: ClaimStatus | ExecuteStatus,
    txRequest: ITxRequest
  ): void {
    switch (status) {
      case ClaimStatus.SUCCESS:
        this.config.logger.info('CLAIMED.', txRequest.address); //TODO: replace with SUCCESS string
        break;
      case ExecuteStatus.SUCCESS:
        this.config.logger.info('EXECUTED.', txRequest.address); //TODO: replace with SUCCESS string
        break;
      case ClaimStatus.ACCOUNT_BUSY:
      case ClaimStatus.NOT_ENABLED:
      case ClaimStatus.PENDING:
      case ExecuteStatus.WALLET_BUSY:
      case ExecuteStatus.PENDING:
        this.config.logger.info(status, txRequest.address);
        break;
      case ClaimStatus.FAILED:
      case ExecuteStatus.FAILED:
        this.config.logger.error(status, txRequest.address);
        break;
      case ClaimStatus.IN_PROGRESS:
      case ExecuteStatus.IN_PROGRESS:
        // skip logging this status
        break;
    }
  }
}
