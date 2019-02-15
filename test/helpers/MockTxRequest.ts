import BigNumber from 'bignumber.js';
import * as moment from 'moment';
import { TxStatus, FnSignatures } from '../../src/Enum';
import Web3 = require('web3');
import { ITransactionRequest } from '@ethereum-alarm-clock/lib';

const mockTxRequest = async (
  web3: Web3,
  isBlock: boolean = false
): Promise<ITransactionRequest> => {
  const claimedBy = '0x0000000000000000000000000000000000000000';
  const requiredDeposit = new BigNumber(web3.utils.toWei('0.1', 'ether'));

  const hoursLater = (num: number) =>
    moment()
      .add(num, 'hour')
      .unix();
  const daysLater = (num: number) =>
    moment()
      .add(num, 'day')
      .unix();

  const currentBlockNumber = await web3.eth.getBlockNumber();
  const blocksLater = (num: number) => currentBlockNumber + num;
  const oneHourWindowSize = new BigNumber(isBlock ? 255 : 3600);

  return {
    address: '0x24f8e3501b00bd219e864650f5625cd4f9272a25',
    bounty: new BigNumber(web3.utils.toWei('0.1', 'ether')),
    callGas: new BigNumber(Math.pow(10, 6)),
    gasPrice: new BigNumber(web3.utils.toWei('21', 'gwei')),
    claimedBy,
    isClaimed: false,
    requiredDeposit,
    temporalUnit: isBlock ? 1 : 2,
    claimWindowStart: new BigNumber(isBlock ? blocksLater(100) : hoursLater(1)),
    windowStart: new BigNumber(isBlock ? blocksLater(300) : daysLater(1)),
    windowSize: oneHourWindowSize,
    freezePeriod: oneHourWindowSize, // ~1h
    reservedWindowSize: oneHourWindowSize,
    wasCalled: false,
    get claimData() {
      return FnSignatures.claim;
    },
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
    async claimPaymentModifier(): Promise<BigNumber> {
      return new BigNumber(100);
    },
    isClaimedBy(address: string) {
      return this.claimedBy === address;
    },
    async beforeClaimWindow(): Promise<boolean> {
      return this.claimWindowStart.isGreaterThan(await this.now());
    },
    async inClaimWindow() {
      const now = await this.now();
      return (
        this.claimWindowStart.isLessThanOrEqualTo(now) && this.claimWindowEnd.isGreaterThan(now)
      );
    },
    async inFreezePeriod() {
      const now = await this.now();
      return (
        this.claimWindowEnd.isLessThanOrEqualTo(now) && this.freezePeriodEnd.isGreaterThan(now)
      );
    },
    async inExecutionWindow() {
      const now = await this.now();
      return (
        this.windowStart.isLessThanOrEqualTo(now) &&
        this.executionWindowEnd.isGreaterThanOrEqualTo(now)
      );
    },
    async inReservedWindow() {
      const now = await this.now();
      return this.windowStart.isLessThanOrEqualTo(now) && this.reservedWindowEnd.isGreaterThan(now);
    },
    async now(): Promise<BigNumber> {
      return new BigNumber(isBlock ? new BigNumber(currentBlockNumber) : moment().unix());
    },
    async refreshData(): Promise<any> {
      return true;
    },
    executeData: '',
    isCancelled: false
  } as ITransactionRequest;
};

const mockTxStatus = async (
  tx: ITransactionRequest,
  status: TxStatus
): Promise<ITransactionRequest> => {
  if (status === TxStatus.BeforeClaimWindow) {
    return tx;
  }

  if (status === TxStatus.ClaimWindow) {
    const claimWindowStart =
      tx.temporalUnit === 1
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
    tx.windowStart = await tx.now();
  }

  if (status === TxStatus.Executed) {
    const windowStarts =
      tx.temporalUnit === 1
        ? 0
        : moment()
            .subtract(1, 'week')
            .unix();

    tx.isClaimed = true;
    tx.wasCalled = true;
    tx.claimWindowStart = new BigNumber(windowStarts);
    tx.windowStart = new BigNumber(windowStarts);
    if (tx.temporalUnit === 1) {
      tx.windowSize = new BigNumber(windowStarts);
    }
  }

  if (status === TxStatus.Missed) {
    const windowStarts =
      tx.temporalUnit === 1
        ? 0
        : moment()
            .subtract(1, 'week')
            .unix();

    tx.claimWindowStart = new BigNumber(windowStarts);
    tx.windowStart = new BigNumber(windowStarts);
    if (tx.temporalUnit === 1) {
      tx.windowSize = new BigNumber(windowStarts);
    }
  }

  return tx;
};

export { mockTxRequest, mockTxStatus };
