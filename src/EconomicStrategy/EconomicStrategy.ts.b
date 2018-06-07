import BigNumber from 'bignumber.js';

interface IEconomicStrategy {
  maxDeposit?: BigNumber;
  minBalance?: BigNumber;
  minProfitability?: BigNumber;
}

export { IEconomicStrategy };
