import { ITransactionRequest, Util, GasPriceUtil } from '@ethereum-alarm-clock/lib';
import BigNumber from 'bignumber.js';
import { ILogger, DefaultLogger } from '../Logger';

const CLAIMING_GAS_ESTIMATE = 100000; // Claiming gas is around 75k, we add a small surplus

export class ProfitabilityStrategy {
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

    const executionGasAmount = this.util.calculateGasAmount(txRequest);
    let executionSubsidy = new BigNumber(0);

    const { average } = await this.gasPriceUtil.getAdvancedNetworkGasPrice();

    if (txRequest.gasPrice < average) {
      executionSubsidy = average.minus(txRequest.gasPrice).times(executionGasAmount);
    }

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

  private async getPaymentModifier(txRequest: ITransactionRequest) {
    return (await txRequest.claimPaymentModifier()).dividedBy(100);
  }
}
