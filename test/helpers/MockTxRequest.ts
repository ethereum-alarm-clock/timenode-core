import BigNumber from 'bignumber.js';
import * as moment from 'moment';
import * as Bb from 'bluebird';
import { TxStatus, FnSignatures } from '../../src/Enum';

const MockTxRequest = async (web3: any, isBlock?: boolean) => {
  const from = '0x74f8e3501b00bd219e864650f5625cd4f9272a75';
  const claimedBy = '0x0000000000000000000000000000000000000000';
  const requiredDeposit = new BigNumber(web3.toWei(0.1, 'ether'));
  const nonce = 156510;

  const hoursLater = (num: number) =>
    moment()
      .add(num, 'hour')
      .unix();
  const daysLater = (num: number) =>
    moment()
      .add(num, 'day')
      .unix();

  const blocksLater = (num: number) => currentBlockNumber + num;

  const oneHourWindowSize = new BigNumber(isBlock ? 255 : 3600);

  const currentBlockNumber = (await Bb.fromCallback((callback: any) =>
    web3.eth.getBlockNumber(callback)
  )) as number;

  return {
    isBlock,
    address: '0x24f8e3501b00bd219e864650f5625cd4f9272a25',
    bounty: new BigNumber(web3.toWei(0.1, 'ether')),
    callGas: new BigNumber(Math.pow(10, 6)),
    gasPrice: new BigNumber(web3.toWei(21, 'gwei')),
    claimedBy,
    claimData: FnSignatures.claim,
    isClaimed: false,
    requiredDeposit,
    temporalUnit: isBlock ? 1 : 2,
    currentBlockNumber: new BigNumber(currentBlockNumber),
    claimWindowStart: new BigNumber(isBlock ? blocksLater(100) : hoursLater(1)),
    windowStart: new BigNumber(isBlock ? blocksLater(300) : daysLater(1)),
    windowSize: oneHourWindowSize,
    freezePeriod: oneHourWindowSize, // ~1h
    reservedWindowSize: oneHourWindowSize,
    receipt: {},
    wasCalled: false,
    params: [
      nonce,
      from,
      from,
      new BigNumber(Math.pow(10, 6)),
      new BigNumber(web3.toWei(21, 'gwei')),
      new BigNumber(web3.toWei(0.01, 'ether')),
      new BigNumber(web3.toWei(0.1, 'ether')),
      'data'
    ],
    get claimWindowEnd() {
      return this.windowStart.minus(this.freezePeriod);
    },
    get freezePeriodEnd() {
      return this.claimWindowEnd.plus(this.freezePeriod);
    },
    get reservedWindowEnd() {
      return this.windowStart.plus(this.reservedWindowSize);
    },
    get executionWindowEnd() {
      return this.windowStart.plus(this.windowSize);
    },
    claimPaymentModifier() {
      return new BigNumber(100);
    },
    isClaimedBy(address: string) {
      return this.claimedBy === address;
    },
    beforeClaimWindow() {
      return this.claimWindowStart.greaterThan(this.now());
    },
    inClaimWindow() {
      const now = this.now();
      return this.claimWindowStart.lessThanOrEqualTo(now) && this.claimWindowEnd.greaterThan(now);
    },
    inFreezePeriod() {
      const now = this.now();
      return this.claimWindowEnd.lessThanOrEqualTo(now) && this.freezePeriodEnd.greaterThan(now);
    },
    inExecutionWindow() {
      const now = this.now();
      return (
        this.windowStart.lessThanOrEqualTo(now) && this.executionWindowEnd.greaterThanOrEqualTo(now)
      );
    },
    inReservedWindow() {
      const now = this.now();
      return this.windowStart.lessThanOrEqualTo(now) && this.reservedWindowEnd.greaterThan(now);
    },
    now() {
      return new BigNumber(isBlock ? this.currentBlockNumber : moment().unix());
    },
    refreshData() {}
  };
};

const mockTxStatus = (tx: any, status: TxStatus) => {
  if (status === TxStatus.BeforeClaimWindow) {
    return tx;
  }

  if (status === TxStatus.ClaimWindow) {
    const claimWindowStart = tx.isBlock
      ? 0
      : moment()
          .subtract(1, 'hour')
          .unix();
    tx.claimWindowStart = new BigNumber(claimWindowStart);
  }

  if (status === TxStatus.FreezePeriod) {
    tx.claimWindowStart = tx.claimWindowStart.minus(tx.freezePeriod);
  }

  if (status === TxStatus.ExecutionWindow) {
    tx.isClaimed = true;
    tx.windowStart = tx.now();
  }

  if (status === TxStatus.Executed) {
    const windowStarts = tx.isBlock
      ? 0
      : moment()
          .subtract(1, 'week')
          .unix();

    tx.isClaimed = true;
    tx.wasCalled = true;
    tx.claimWindowStart = new BigNumber(windowStarts);
    tx.windowStart = new BigNumber(windowStarts);
    if (tx.isBlock) {
      tx.windowSize = new BigNumber(windowStarts);
    }
  }

  if (status === TxStatus.Missed) {
    const windowStarts = tx.isBlock
      ? 0
      : moment()
          .subtract(1, 'week')
          .unix();

    tx.claimWindowStart = new BigNumber(windowStarts);
    tx.windowStart = new BigNumber(windowStarts);
    if (tx.isBlock) {
      tx.windowSize = new BigNumber(windowStarts);
    }
  }

  return tx;
};

export { MockTxRequest, mockTxStatus };
