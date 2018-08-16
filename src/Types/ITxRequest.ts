import { BigNumber } from 'bignumber.js';

export interface ITxRequest extends ITxRequestPending {
  claimedBy: string;
  requiredDeposit: BigNumber;
  claimData: string;
  executeData: string;
  bounty: BigNumber;
  callGas: BigNumber;
  isCancelled: boolean;
  isClaimed: boolean;
  wasCalled: boolean;
  executionWindowEnd: BigNumber;
  temporalUnit: number;
  claimWindowStart: BigNumber;
  windowStart: BigNumber;
  windowSize: BigNumber;
  freezePeriod: BigNumber;
  reservedWindowSize: BigNumber;
  claimWindowEnd: BigNumber;
  freezePeriodEnd: BigNumber;
  reservedWindowEnd: BigNumber;

  refreshData(): Promise<any>;
  claimPaymentModifier(): Promise<BigNumber>; //TODO: refactor as BigNumber not required here
  inReservedWindow(): Promise<boolean>;
  beforeClaimWindow(): Promise<boolean>;
  inClaimWindow(): Promise<boolean>;
  inFreezePeriod(): Promise<boolean>;
  inExecutionWindow(): Promise<boolean>;
  now(): Promise<BigNumber>;
  isClaimedBy(address: string): boolean;
}

export interface ITxRequestPending {
  address: string;
  gasPrice: BigNumber;
}

export interface ITxRequestRaw {
  address: string;
  params: BigNumber[];
}
