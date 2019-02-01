import { ITransactionRequest, Util, GasPriceUtil } from '@ethereum-alarm-clock/lib';
import BigNumber from 'bignumber.js';
import { ILogger, DefaultLogger } from '../Logger';

const CLAIMING_GAS_ESTIMATE = 100000; // Claiming gas is around 75k, we add a small surplus

export class ProfitabilityCalculator {
  private util: Util;
  private logger: ILogger;
  private gasPriceUtil: GasPriceUtil;

  constructor(util: Util, gasPriceUtil: GasPriceUtil, logger: ILogger = new DefaultLogger()) {
    this.util = util;
    this.gasPriceUtil = gasPriceUtil;
    this.logger = logger;
  }

  public async claimingProfitability(txRequest: ITransactionRequest, claimingGasPrice: BigNumber) {
    const paymentModifier = await this.getPaymentModifier(txRequest);
    const claimingGasCost = claimingGasPrice.times(CLAIMING_GAS_ESTIMATE);
    const { average } = await this.gasPriceUtil.getAdvancedNetworkGasPrice();
    const executionSubsidy = this.calculateExecutionSubsidy(txRequest, average);

    const reward = txRequest.bounty
      .times(paymentModifier)
      .minus(claimingGasCost)
      .minus(executionSubsidy);

    this.logger.debug(
      `claimingProfitability: paymentModifier=${paymentModifier} targetGasPrice=${claimingGasPrice} bounty=${
        txRequest.bounty
      } reward=${reward}`,
      txRequest.address
    );

    return reward;
  }

  public async executionProfitability(
    txRequest: ITransactionRequest,
    executionGasPrice: BigNumber
  ) {
    const paymentModifier = await this.getPaymentModifier(txRequest);
    const executionSubsidy = this.calculateExecutionSubsidy(txRequest, executionGasPrice);
    const { requiredDeposit, bounty } = txRequest;

    const reward = bounty
      .times(paymentModifier)
      .minus(executionSubsidy)
      .plus(txRequest.isClaimed ? requiredDeposit : 0)
      .round();

    this.logger.debug(
      `executionProfitability: executionSubsidy=${executionSubsidy} for executionGasPrice=${executionGasPrice} returns expectedReward=${reward}`,
      txRequest.address
    );

    return reward;
  }

  private calculateExecutionSubsidy(txRequest: ITransactionRequest, gasPrice: BigNumber) {
    let executionSubsidy = new BigNumber(0);

    if (txRequest.gasPrice < gasPrice) {
      const executionGasAmount = this.util.calculateGasAmount(txRequest);
      executionSubsidy = gasPrice.minus(txRequest.gasPrice).times(executionGasAmount);
    }

    return executionSubsidy;
  }

  private async getPaymentModifier(txRequest: ITransactionRequest) {
    return (await txRequest.claimPaymentModifier()).dividedBy(100);
  }
}
