import IActions from '../Actions';
import { TxSendStatus, EconomicStrategyStatus, TxStatus } from '../Enum';
import { Address } from '../Types';
import { IEconomicStrategyManager } from '../EconomicStrategy/EconomicStrategyManager';
import Cache, { ICachedTxDetails } from '../Cache';
import { ILogger } from '../Logger';
import { Wallet } from '../Wallet';
import { Operation } from '../Types/Operation';
import { ITransactionRequest, GasPriceUtil } from '@ethereum-alarm-clock/lib';

type Transition = (txRequest: ITransactionRequest) => Promise<TxStatus>;

export default interface IRouter {
  route(txRequest: ITransactionRequest): Promise<TxStatus>;
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
  private gasPriceUtil: GasPriceUtil;

  constructor(
    isClaimingEnabled: boolean,
    cache: Cache<ICachedTxDetails>,
    logger: ILogger,
    actions: IActions,
    economicStrategyManager: IEconomicStrategyManager,
    gasPriceUtil: GasPriceUtil,
    wallet: Wallet
  ) {
    this.actions = actions;
    this.cache = cache;
    this.logger = logger;
    this.wallet = wallet;
    this.economicStrategyManager = economicStrategyManager;
    this.isClaimingEnabled = isClaimingEnabled;
    this.gasPriceUtil = gasPriceUtil;

    this.transitions
      .set(TxStatus.BeforeClaimWindow, this.beforeClaimWindow.bind(this))
      .set(TxStatus.ClaimWindow, this.claimWindow.bind(this))
      .set(TxStatus.FreezePeriod, this.freezePeriod.bind(this))
      .set(TxStatus.ExecutionWindow, this.executionWindow.bind(this))
      .set(TxStatus.Executed, this.executed.bind(this))
      .set(TxStatus.Missed, this.missed.bind(this))
      .set(TxStatus.Done, this.done.bind(this));
  }

  public async beforeClaimWindow(txRequest: ITransactionRequest): Promise<TxStatus> {
    if (txRequest.isCancelled) {
      // TODO Status.CleanUp?
      return TxStatus.Executed;
    }

    if (await txRequest.beforeClaimWindow()) {
      return TxStatus.BeforeClaimWindow;
    }

    return TxStatus.ClaimWindow;
  }

  public async claimWindow(txRequest: ITransactionRequest): Promise<TxStatus> {
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
      const fastestGas = (await this.gasPriceUtil.getAdvancedNetworkGasPrice()).fastest;
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
            claimingStatus === TxSendStatus.STATUS(TxSendStatus.SUCCESS, context) ||
            claimingStatus === TxSendStatus.STATUS(TxSendStatus.FAIL, context)
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

  public async freezePeriod(txRequest: ITransactionRequest): Promise<TxStatus> {
    if (await txRequest.inFreezePeriod()) {
      return TxStatus.FreezePeriod;
    }

    if (await txRequest.inExecutionWindow()) {
      return TxStatus.ExecutionWindow;
    }

    return TxStatus.FreezePeriod;
  }

  public async inReservedWindowAndNotClaimedLocally(
    txRequest: ITransactionRequest
  ): Promise<boolean> {
    const inReserved = await txRequest.inReservedWindow();
    return inReserved && txRequest.isClaimed && !this.isLocalClaim(txRequest);
  }

  public async executionWindow(txRequest: ITransactionRequest): Promise<TxStatus> {
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

        if (executionStatus === TxSendStatus.STATUS(TxSendStatus.SUCCESS, context)) {
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

  public async executed(txRequest: ITransactionRequest): Promise<TxStatus> {
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

  public async isTransactionMissed(txRequest: ITransactionRequest): Promise<boolean> {
    const now = await txRequest.now();
    const afterExecutionWindow = txRequest.executionWindowEnd.lessThanOrEqualTo(now);

    return afterExecutionWindow && !txRequest.wasCalled;
  }

  public isLocalClaim(txRequest: ITransactionRequest): boolean {
    const localClaim = this.wallet.isKnownAddress(txRequest.claimedBy);

    if (!localClaim) {
      this.logger.debug(`In reserve window and not claimed by this TimeNode.`, txRequest.address);
    }

    return localClaim;
  }

  public async route(txRequest: ITransactionRequest): Promise<TxStatus> {
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

  private async done(txRequest: ITransactionRequest): Promise<TxStatus> {
    this.logger.info('Finished. Deleting from cache...', txRequest.address);
    this.cache.del(txRequest.address);
    return TxStatus.Done;
  }

  private handleWalletTransactionResult(
    status: TxSendStatus,
    txRequest: ITransactionRequest
  ): void {
    switch (status) {
      case TxSendStatus.STATUS(TxSendStatus.SUCCESS, TxSendStatus.claim):
        this.logger.info('CLAIMED.', txRequest.address); //TODO: replace with SUCCESS string
        break;
      case TxSendStatus.STATUS(TxSendStatus.SUCCESS, TxSendStatus.execute):
        this.logger.info('EXECUTED.', txRequest.address); //TODO: replace with SUCCESS string
        break;
      case TxSendStatus.STATUS(TxSendStatus.BUSY, TxSendStatus.claim):
      case TxSendStatus.NOT_ENABLED:
      case TxSendStatus.STATUS(TxSendStatus.PENDING, TxSendStatus.claim):
      case TxSendStatus.STATUS(TxSendStatus.BUSY, TxSendStatus.execute):
      case TxSendStatus.STATUS(TxSendStatus.PENDING, TxSendStatus.execute):
      case TxSendStatus.STATUS(TxSendStatus.MINED_IN_UNCLE, TxSendStatus.execute):
      case TxSendStatus.STATUS(TxSendStatus.MINED_IN_UNCLE, TxSendStatus.claim):
        this.logger.info(status, txRequest.address);
        break;
      case TxSendStatus.STATUS(TxSendStatus.FAIL, TxSendStatus.claim):
      case TxSendStatus.STATUS(TxSendStatus.FAIL, TxSendStatus.execute):
      case TxSendStatus.ABORTED_AFTER_CALL_WINDOW:
      case TxSendStatus.ABORTED_BEFORE_CALL_WINDOW:
      case TxSendStatus.ABORTED_ALREADY_CALLED:
      case TxSendStatus.ABORTED_INSUFFICIENT_GAS:
      case TxSendStatus.ABORTED_RESERVED_FOR_CLAIMER:
      case TxSendStatus.ABORTED_TOO_LOW_GAS_PRICE:
      case TxSendStatus.ABORTED_WAS_CANCELLED:
        this.logger.error(status, txRequest.address);
        break;
      case TxSendStatus.STATUS(TxSendStatus.PROGRESS, TxSendStatus.claim):
      case TxSendStatus.STATUS(TxSendStatus.PROGRESS, TxSendStatus.execute):
        // skip logging this status
        break;
    }
  }
}
