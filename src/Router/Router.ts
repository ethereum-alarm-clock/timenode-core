import Actions from '../Actions';
import Config from '../Config';
import { TxStatus } from '../Enum';
import { shouldClaimTx } from '../EconomicStrategy';

import * as Bb from 'bluebird';
import * as moment from 'moment';

export class TEMPORAL_UNIT {
  static BLOCK = 1;
  static TIMESTAMP = 2;
}

export default class Router {
  actions: Actions;
  config: Config;
  txRequestStates: Object = {};

  transitions: Object = {};

  constructor(config: Config, actions: any) {
    this.actions = actions;
    this.config = config;

    this.transitions[TxStatus.BeforeClaimWindow] = this.beforeClaimWindow.bind(
      this
    );
    this.transitions[TxStatus.ClaimWindow] = this.claimWindow.bind(this);
    this.transitions[TxStatus.FreezePeriod] = this.freezePeriod.bind(this);
    this.transitions[TxStatus.ExecutionWindow] = this.executionWindow.bind(
      this
    );
    this.transitions[TxStatus.Executed] = this.executed.bind(this);
    this.transitions[TxStatus.Missed] = (txRequest: any) => {
      console.log('missed: ', txRequest.address);
      // this.config.cache.del(txRequest.address);
      return TxStatus.Missed;
    };

    this.transitions[TxStatus.Done] = (txRequest: any) => {
      console.log('done: ', txRequest.address);
      // this.config.cache.del(txRequest.address);

      return TxStatus.Done;
    };
  }

  async getBlockNumber() {
    return Bb.fromCallback((callback: any) =>
      this.config.web3.eth.getBlockNumber(callback)
    );
  }

  async beforeClaimWindow(txRequest: any): Promise<TxStatus> {
    if (txRequest.isCancelled) {
      // TODO Status.CleanUp?
      return TxStatus.Executed;
    }

    if (await txRequest.beforeClaimWindow()) {
      return TxStatus.BeforeClaimWindow;
    }

    return TxStatus.ClaimWindow;
  }

  async claimWindow(txRequest: any): Promise<TxStatus> {
    if (!(await txRequest.inClaimWindow())) {
      return TxStatus.FreezePeriod;
    }
    if (txRequest.isClaimed) {
      return TxStatus.FreezePeriod;
    }

    const shouldClaim = await shouldClaimTx(txRequest, this.config);

    if (shouldClaim) {
      try {
        const claimed = await this.actions.claim(txRequest);

        if (claimed === true) {
          this.config.logger.info(`${txRequest.address} claimed`);
        }
      } catch (e) {
        this.config.logger.error(`${txRequest.address} claiming failed`);
        // TODO handle gracefully?
        throw new Error(e);
      }
    }

    return TxStatus.ClaimWindow;
  }

  async freezePeriod(txRequest: any): Promise<TxStatus> {
    if (await txRequest.inFreezePeriod()) {
      return TxStatus.FreezePeriod;
    }

    if (await txRequest.inExecutionWindow()) {
      return TxStatus.ExecutionWindow;
    }

    return TxStatus.FreezePeriod;
  }

  isTxUnitTimestamp(transaction: any) {
    if (!transaction || !transaction.temporalUnit) {
      return false;
    }

    let temporalUnit = transaction.temporalUnit;

    if (transaction.temporalUnit.toNumber) {
      temporalUnit = transaction.temporalUnit.toNumber();
    }

    return temporalUnit === TEMPORAL_UNIT.TIMESTAMP;
  }

  async isTransactionMissed(transaction: any): Promise<boolean> {
    let afterExecutionWindow;

    if (this.isTxUnitTimestamp(transaction)) {
      afterExecutionWindow = transaction.executionWindowEnd.lessThan(
        moment().unix()
      );
    } else {
      afterExecutionWindow = transaction.executionWindowEnd.lessThan(
        await this.getBlockNumber()
      );
    }

    return Boolean(afterExecutionWindow && !transaction.wasCalled);
  }

  async executionWindow(txRequest: any): Promise<TxStatus> {
    if (txRequest.wasCalled) {
      return TxStatus.Executed;
    }

    const reserved = await txRequest.inReservedWindow();
    if (reserved && !this.isLocalClaim(txRequest)) {
      return TxStatus.ExecutionWindow;
    }

    try {
      const executed = await this.actions.execute(txRequest);

      if (executed === true) {
        return TxStatus.Executed;
      }
    } catch (e) {
      //TODO handle gracefully?
      throw new Error(e);
    }

    return TxStatus.ExecutionWindow;
  }

  async executed(txRequest: any): Promise<TxStatus> {
    /**
     * We don't cleanup because cleanup needs refactor according to latest logic in EAC
     * https://github.com/ethereum-alarm-clock/ethereum-alarm-clock/blob/master/contracts/Library/RequestLib.sol#L433
     *
     * await this.actions.cleanup(txRequest);
     */
    //

    return TxStatus.Done;
  }

  isLocalClaim(txRequest: any) {
    let localClaim;
    // TODO add function on config `hasWallet(): boolean`
    if (this.config.wallet) {
      localClaim = this.config.wallet.isKnownAddress(txRequest.claimedBy);
    } else {
      localClaim = txRequest.isClaimedBy(this.config.web3.defaultAccount);
    }

    if (!localClaim) {
      this.config.logger.debug(
        `[${
          txRequest.address
        }] In reserve window and not claimed by this TimeNode.`
      );
    }

    return localClaim;
  }

  async isProfitableClaim(txRequest: any) {
    const claimPaymentModifier = await txRequest.claimPaymentModifier();
    const paymentWhenClaimed = txRequest.bounty
      .times(claimPaymentModifier)
      .dividedToIntegerBy(100);

    // TODO
  }

  // TODO do not return void
  async route(txRequest: any): Promise<any> {
    let status: TxStatus =
      this.txRequestStates[txRequest.address] || TxStatus.BeforeClaimWindow;

    const statusFunction = this.transitions[status];
    let nextStatus: TxStatus = await statusFunction(txRequest);

    while (nextStatus !== status) {
      this.config.logger.info(
        `${txRequest.address} Transitioning from  ${TxStatus[status]} to ${
          TxStatus[nextStatus]
        } (${nextStatus})`
      );
      status = nextStatus;
      nextStatus = await this.transitions[status](txRequest);
    }

    this.txRequestStates[txRequest.address] = nextStatus;
    return nextStatus;
  }
}
