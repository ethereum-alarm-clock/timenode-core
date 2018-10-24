import IActions from '../Actions';
import { TxSendStatus, EconomicStrategyStatus, TxStatus } from '../Enum';
import { Address, ITxRequest } from '../Types';
import { IEconomicStrategyManager } from '../EconomicStrategy/EconomicStrategyManager';
import Cache, { ICachedTxDetails } from '../Cache';
import { ILogger } from '../Logger';
import { Wallet } from '../Wallet';
import { Operation } from '../Types/Operation';
import { W3Util } from '..';

type Transition = (txRequest: ITxRequest) => Promise<TxStatus>;

export default interface IRouter {
  route(txRequest: ITxRequest): Promise<TxStatus>;
}

export default class Router implements IRouter {
  private actions: IActions;
  private cache: Cache<ICachedTxDetails>;
  private logger: ILogger;
  private txRequestStates: object = {};
  private transitions: Map<TxStatus, Transition> = new Map<TxStatus, Transition>();
  private economicStrategyManager: IEconomicStrategyManager;
  private wallet: Wallet;
  private isClaimingEnabled: boolean;
  private util: W3Util;

  constructor(
    isClaimingEnabled: boolean,
    cache: Cache<ICachedTxDetails>,
    logger: ILogger,
    actions: IActions,
    economicStrategyManager: IEconomicStrategyManager,
    util: W3Util,
    wallet: Wallet
  ) {
    this.actions = actions;
    this.cache = cache;
    this.logger = logger;
    this.wallet = wallet;
    this.economicStrategyManager = economicStrategyManager;
    this.isClaimingEnabled = isClaimingEnabled;
    this.util = util;

    this.transitions
      .set(TxStatus.BeforeClaimWindow, this.beforeClaimWindow.bind(this))
      .set(TxStatus.ClaimWindow, this.claimWindow.bind(this))
      .set(TxStatus.FreezePeriod, this.freezePeriod.bind(this))
      .set(TxStatus.ExecutionWindow, this.executionWindow.bind(this))
      .set(TxStatus.Executed, this.executed.bind(this))
      .set(TxStatus.Missed, this.missed.bind(this))
      .set(TxStatus.Done, this.done.bind(this));
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
    const context = TxSendStatus.claim;
    if (this.wallet.isWaitingForConfirmation(txRequest.address, Operation.CLAIM)) {
      return TxStatus.ClaimWindow;
    }

    if (!(await txRequest.inClaimWindow()) || txRequest.isClaimed) {
      this.cache.get(txRequest.address).claimedBy = txRequest.claimedBy;
      return TxStatus.FreezePeriod;
    }

    if (this.isClaimingEnabled) {
      const nextAccount: Address = this.wallet.nextAccount.getAddressString();
      const fastestGas = (await this.util.getAdvancedNetworkGasPrice()).fastest;
      const shouldClaimStatus: EconomicStrategyStatus = await this.economicStrategyManager.shouldClaimTx(
        txRequest,
        nextAccount,
        fastestGas
      );

      if (shouldClaimStatus === EconomicStrategyStatus.CLAIM) {
        try {
          const claimingStatus: TxSendStatus = await this.actions.claim(
            txRequest,
            nextAccount,
            fastestGas
          );

          this.handleWalletTransactionResult(claimingStatus, txRequest);

          if (
            claimingStatus === TxSendStatus.STATUS(context, TxSendStatus.SUCCESS) ||
            claimingStatus === TxSendStatus.STATUS(context, TxSendStatus.FAIL)
          ) {
            return TxStatus.FreezePeriod;
          }
        } catch (err) {
          this.logger.error(err, txRequest.address);
          throw new Error(err);
        }
      } else {
        this.logger.info(`Claiming: Skipped - ${shouldClaimStatus}`, txRequest.address);
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
    const context = TxSendStatus.execute;
    if (this.wallet.isWaitingForConfirmation(txRequest.address, Operation.EXECUTE)) {
      return TxStatus.ExecutionWindow;
    }
    if (txRequest.wasCalled) {
      return TxStatus.Executed;
    }
    if (await this.isTransactionMissed(txRequest)) {
      return TxStatus.Missed;
    }

    if (await this.inReservedWindowAndNotClaimedLocally(txRequest)) {
      return TxStatus.ExecutionWindow;
    }

    const executionGas = await this.economicStrategyManager.getExecutionGasPrice(txRequest);
    const shouldExecute = await this.economicStrategyManager.shouldExecuteTx(
      txRequest,
      executionGas
    );

    if (shouldExecute) {
      try {
        const executionStatus: TxSendStatus = await this.actions.execute(txRequest, executionGas);

        this.handleWalletTransactionResult(executionStatus, txRequest);

        if (executionStatus === TxSendStatus.STATUS(context, TxSendStatus.SUCCESS)) {
          return TxStatus.Executed;
        }
      } catch (err) {
        this.logger.error(err, txRequest.address);
        throw new Error(err);
      }
    } else {
      this.logger.info('Not profitable to execute. Gas price too high.', txRequest.address);
    }

    return TxStatus.ExecutionWindow;
  }

  public async executed(txRequest: ITxRequest): Promise<TxStatus> {
    /**
     * We don't cleanup because cleanup needs refactor according to latest logic in EAC
     * https://github.com/ethereum-alarm-clock/ethereum-alarm-clock/blob/master/contracts/Library/RequestLib.sol#L433
     *
     * await this.actions.cleanup(txRequest);
     */
    this.cache.get(txRequest.address).wasCalled = true;

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
    const localClaim = this.wallet.isKnownAddress(txRequest.claimedBy);

    if (!localClaim) {
      this.logger.debug(`In reserve window and not claimed by this TimeNode.`, txRequest.address);
    }

    return localClaim;
  }

  public async route(txRequest: ITxRequest): Promise<TxStatus> {
    let current: TxStatus = this.txRequestStates[txRequest.address] || TxStatus.BeforeClaimWindow;
    let previous;

    try {
      while (current !== previous) {
        const transition = this.transitions.get(current);
        const next = await transition(txRequest);
        if (current !== next) {
          this.logger.debug(
            `Transition from ${TxStatus[current]} to ${TxStatus[next]} completed`,
            txRequest.address
          );
        }

        previous = current;
        current = next;
      }
    } catch (err) {
      this.logger.error(`Transition from ${TxStatus[current]} failed: ${err}`);
    }

    this.txRequestStates[txRequest.address] = current;
    return current;
  }

  private async done(txRequest: ITxRequest): Promise<TxStatus> {
    this.logger.info('Finished. Deleting from cache...', txRequest.address);
    this.cache.del(txRequest.address);
    return TxStatus.Done;
  }

  private handleWalletTransactionResult(status: TxSendStatus, txRequest: ITxRequest): void {
    switch (status) {
      case TxSendStatus.STATUS(TxSendStatus.claim, TxSendStatus.SUCCESS):
        this.logger.info('CLAIMED.', txRequest.address); //TODO: replace with SUCCESS string
        break;
      case TxSendStatus.STATUS(TxSendStatus.execute, TxSendStatus.SUCCESS):
        this.logger.info('EXECUTED.', txRequest.address); //TODO: replace with SUCCESS string
        break;
      case TxSendStatus.STATUS(TxSendStatus.claim, TxSendStatus.BUSY):
      case TxSendStatus.NOT_ENABLED:
      case TxSendStatus.STATUS(TxSendStatus.claim, TxSendStatus.PENDING):
      case TxSendStatus.STATUS(TxSendStatus.execute, TxSendStatus.BUSY):
      case TxSendStatus.STATUS(TxSendStatus.execute, TxSendStatus.PENDING):
      case TxSendStatus.STATUS(TxSendStatus.execute, TxSendStatus.MINED):
      case TxSendStatus.STATUS(TxSendStatus.claim, TxSendStatus.MINED):
        this.logger.info(status, txRequest.address);
        break;
      case TxSendStatus.STATUS(TxSendStatus.claim, TxSendStatus.FAIL):
      case TxSendStatus.STATUS(TxSendStatus.execute, TxSendStatus.FAIL):
      case TxSendStatus.ABORTED_AFTER_CALL_WINDOW:
      case TxSendStatus.ABORTED_BEFORE_CALL_WINDOW:
      case TxSendStatus.ABORTED_ALREADY_CALLED:
      case TxSendStatus.ABORTED_INSUFFICIENT_GAS:
      case TxSendStatus.ABORTED_RESERVED_FOR_CLAIMER:
      case TxSendStatus.ABORTED_TOO_LOW_GAS_PRICE:
      case TxSendStatus.ABORTED_WAS_CANCELLED:
        this.logger.error(status, txRequest.address);
        break;
      case TxSendStatus.STATUS(TxSendStatus.claim, TxSendStatus.PROGRESS):
      case TxSendStatus.STATUS(TxSendStatus.execute, TxSendStatus.PROGRESS):
        // skip logging this status
        break;
    }
  }
}
