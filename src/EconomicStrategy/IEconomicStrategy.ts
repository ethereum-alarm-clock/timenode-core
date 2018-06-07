import BigNumber from 'bignumber.js';

export interface IEconomicStrategy {
  maxDeposit?: BigNumber;
  minBalance?: BigNumber;
  minProfitability?: BigNumber;
}
