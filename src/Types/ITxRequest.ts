import { BigNumber } from 'bignumber.js';

// TODO this is only temporary
export interface ITxRequest {
  address: string;
  claimedBy: string;
  gasPrice: BigNumber;
  requiredDeposit: BigNumber;
  claimData: string;
  executeData: string;
  bounty: BigNumber;
  callGas: BigNumber;
  isCancelled: boolean;
  isClaimed: boolean;
  wasCalled: boolean;
  executionWindowEnd: BigNumber;

  refreshData(): Promise<any>;
  claimPaymentModifier(): Promise<BigNumber>; //TODO: refactor as BigNumber not required here
  inReservedWindow(): boolean;
  beforeClaimWindow(): Promise<boolean>;
  inClaimWindow(): Promise<boolean>;
  inFreezePeriod(): Promise<boolean>;
  inExecutionWindow(): Promise<boolean>;
  now(): Promise<BigNumber>;
}
