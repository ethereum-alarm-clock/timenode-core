import BigNumber from 'bignumber.js';

export interface IEconomicStrategy {
  /**
   * Maximum deposit a TimeNode would be willing
   * to stake while claiming a transaction.
   */
  maxDeposit?: BigNumber;

  /**
   * Minimum balance a TimeNode has to
   * have in order to claim a transaction.
   */
  minBalance?: BigNumber;

  /**
   * Minimum profitability a scheduled transactions
   * has to bring in order for the TimeNode to claim it.
   */
  minProfitability?: BigNumber;

  /**
   * A number which defines the percentage with which
   * the TimeNode would be able to subsidize the amount of gas
   * it sends at the time of the execution.
   *
   * e.g. If the scheduled transaction has set the gas price to 20 gwei
   *      and `maxGasSubsidy` is set to 50, the TimeNode would be willing
   *      to subsidize gas costs to up to 30 gwei.
   */
  maxGasSubsidy?: number;

  minExecutionWindow?: number;

  minExecutionWindowBlock?: number;

  /**
   * Smart gas estimation will use the Eth Gas Station API to
   * retrieve information about the speed of gas prices and pick
   * the gas price which better fits execution situations.
   */
  usingSmartGasEstimation?: boolean;
}
