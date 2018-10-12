import IActions from '../Actions';
import { ClaimStatus, EconomicStrategyStatus, ExecuteStatus, TxStatus } from '../Enum';
import { Address, ITxRequest } from '../Types';
import { IEconomicStrategyManager } from '../EconomicStrategy/EconomicStrategyManager';
import Cache, { ICachedTxDetails } from '../Cache';
import { ILogger } from '../Logger';
import { Wallet } from '../Wallet';
import { Operation } from '../Types/Operation';
import { W3Util } from '..';

export default interface IRouter {
  route(txRequest: ITxRequest): Promise<TxStatus>;
}

export default class Router implements IRouter {
  private actions: IActions;
  private cache: Cache<ICachedTxDetails>;
  private logger: ILogger;
  private txRequestStates: object = {};
  private transitions: object = {};
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

    this.transitions[TxStatus.BeforeClaimWindow] = this.beforeClaimWindow.bind(this);
    this.transitions[TxStatus.ClaimWindow] = this.claimWindow.bind(this);
    this.transitions[TxStatus.FreezePeriod] = this.freezePeriod.bind(this);
    this.transitions[TxStatus.ExecutionWindow] = this.executionWindow.bind(this);
    this.transitions[TxStatus.Executed] = this.executed.bind(this);
    this.transitions[TxStatus.Missed] = this.missed.bind(this);
    this.transitions[TxStatus.Done] = (txRequest: ITxRequest) => {
      this.logger.info('Finished. Deleting from cache...', txRequest.address);
      this.cache.del(txRequest.address);
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
          const claimingStatus: ClaimStatus = await this.actions.claim(
            txRequest,
            nextAccount,
            fastestGas
          );

          this.handleWalletTransactionResult(claimingStatus, txRequest);

          if (claimingStatus === ClaimStatus.SUCCESS || claimingStatus === ClaimStatus.FAILED) {
            return TxStatus.FreezePeriod;
          }
        } catch (err) {
          this.logger.error(err, txRequest.address);
          throw new Error(err);
        }
      } else {
        this.logger.info(`Claiming: Skipped - ${shouldClaimStatus}`, txRequest.address);
        this.logger.debug(
          `ECONOMIC STRATEGY: ${JSON.stringify(this.economicStrategyManager.strategy)}`
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
        const executionStatus: ExecuteStatus = await this.actions.execute(txRequest, executionGas);

        this.handleWalletTransactionResult(executionStatus, txRequest);

        if (executionStatus === ExecuteStatus.SUCCESS) {
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

    while (current !== previous) {
      const next: TxStatus = this.transitions[current](txRequest);

      if (current !== next) {
        this.logger.debug(
          `Transition from ${TxStatus[current]} to ${TxStatus[next]} completed`,
          txRequest.address
        );
      }

      previous = current;
      current = next;
    }

    this.txRequestStates[txRequest.address] = current;
    return previous;
  }

  private handleWalletTransactionResult(
    status: ClaimStatus | ExecuteStatus,
    txRequest: ITxRequest
  ): void {
    switch (status) {
      case ClaimStatus.SUCCESS:
        this.logger.info('CLAIMED.', txRequest.address); //TODO: replace with SUCCESS string
        break;
      case ExecuteStatus.SUCCESS:
        this.logger.info('EXECUTED.', txRequest.address); //TODO: replace with SUCCESS string
        break;
      case ClaimStatus.ACCOUNT_BUSY:
      case ClaimStatus.NOT_ENABLED:
      case ClaimStatus.PENDING:
      case ExecuteStatus.WALLET_BUSY:
      case ExecuteStatus.PENDING:
      case ExecuteStatus.MINED_IN_UNCLE:
      case ClaimStatus.MINED_IN_UNCLE:
        this.logger.info(status, txRequest.address);
        break;
      case ClaimStatus.FAILED:
      case ExecuteStatus.FAILED:
      case ExecuteStatus.ABORTED_AFTER_CALL_WINDOW:
      case ExecuteStatus.ABORTED_BEFORE_CALL_WINDOW:
      case ExecuteStatus.ABORTED_ALREADY_CALLED:
      case ExecuteStatus.ABORTED_INSUFFICIENT_GAS:
      case ExecuteStatus.ABORTED_RESERVED_FOR_CLAIMER:
      case ExecuteStatus.ABORTED_TOO_LOW_GAS_PRICE:
      case ExecuteStatus.ABORTED_WAS_CANCELLED:
        this.logger.error(status, txRequest.address);
        break;
      case ClaimStatus.IN_PROGRESS:
      case ExecuteStatus.IN_PROGRESS:
        // skip logging this status
        break;
    }
  }
}
