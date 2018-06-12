import BigNumber from 'bignumber.js';

import Actions from '../Actions/index';
import Config from '../Config/index';
import { TxStatus } from '../Enum/index';
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
    this.transitions[TxStatus.Missed] = (txRequest) => {
      console.log('missed: ', txRequest.address);
      this.config.cache.del(txRequest.address);

      return TxStatus.Missed;
    };
  }

  async getBlockNumber() {
    return Bb.fromCallback((callback) => this.config.web3.eth.getBlockNumber(callback));
  }

  async beforeClaimWindow(txRequest): Promise<TxStatus> {
    if (txRequest.isCancelled) {
      // TODO Status.CleanUp?
      return TxStatus.Executed;
    }

    console.log(txRequest.windowStart);

    if (await txRequest.beforeClaimWindow()) {
      return TxStatus.BeforeClaimWindow;
    }

    return TxStatus.ClaimWindow;
  }

  async claimWindow(txRequest): Promise<TxStatus> {
    console.log({
      windowStart: txRequest.windowStart.toFixed(),
      windowSize: txRequest.windowSize.toFixed(),
      currentBlock: await this.getBlockNumber(),
      isMissed: await this.isTransactionMissed(txRequest),
      claimWindow: await txRequest.inClaimWindow(),
      wasCalled: txRequest.wasCalled,
      isClaimed: txRequest.isClaimed,
      inExecutionWindow: await txRequest.inExecutionWindow()
    });

    if (!(await txRequest.inClaimWindow())) {
      return TxStatus.FreezePeriod;
    }

    if (txRequest.isClaimed) {
      return TxStatus.ClaimWindow;
    }

    try {
      // check profitability FIRST
      // ... here
      //TODO do we care about return value?
      await this.actions.claim(txRequest);
      this.config.logger.info(`${txRequest.address} CLAIMED`);
    } catch (e) {
      // TODO handle gracefully?
      throw new Error(e);
    }

    return TxStatus.ClaimWindow;
  }

  async freezePeriod(txRequest): Promise<TxStatus> {
    if (await txRequest.inFreezePeriod()) {
      return TxStatus.FreezePeriod;
    }

    if (await txRequest.inExecutionWindow()) {
      return TxStatus.ExecutionWindow;
    }

    if (await this.isTransactionMissed(txRequest)) {
      return TxStatus.Missed;
    }
  }

  isTxUnitTimestamp(transaction) {
    if (!transaction || !transaction.temporalUnit) {
      return false;
    }

    let temporalUnit = transaction.temporalUnit;

    if (transaction.temporalUnit.toNumber) {
      temporalUnit = transaction.temporalUnit.toNumber();
    }

    return temporalUnit === TEMPORAL_UNIT.TIMESTAMP;
  }

  async isTransactionMissed(transaction) : Promise<boolean> {
    let afterExecutionWindow;

    if (this.isTxUnitTimestamp(transaction)) {
      afterExecutionWindow = transaction.executionWindowEnd.lessThan(moment().unix());
    } else {
      afterExecutionWindow = transaction.executionWindowEnd.lessThan(await this.getBlockNumber());
    }

    return Boolean(afterExecutionWindow && !transaction.wasCalled);
  }

  async executionWindow(txRequest): Promise<TxStatus> {
    if (txRequest.wasCalled) {
      return TxStatus.Executed;
    }

    const reserved = await txRequest.inReservedWindow();
    if (reserved && !this.isLocalClaim(txRequest)) {
      return TxStatus.ExecutionWindow;
    }

    try {
      console.log('ATTEMPT EXECUTION');
      await this.actions.execute(txRequest);
    } catch (e) {
      //TODO handle gracefully?
      throw new Error(e);
    }

    return TxStatus.Executed;
  }

  async executed(txRequest): Promise<TxStatus> {
    console.log('CLEANUP TX');
    await this.actions.cleanup(txRequest);
    return TxStatus.Done;
  }

  isLocalClaim(txRequest) {
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

  async isProfitableClaim(txRequest) {
    const claimPaymentModifier = await txRequest.claimPaymentModifier();
    const paymentWhenClaimed = txRequest.bounty
      .times(claimPaymentModifier)
      .dividedToIntegerBy(100);

    // TODO
  }

  // TODO do not return void
  async route(txRequest): Promise<any> {
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
