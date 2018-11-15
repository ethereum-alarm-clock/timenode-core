import { IntervalId, ITxRequest } from '../Types';
import BaseScanner from './BaseScanner';
import IRouter from '../Router';
import Config from '../Config';
import W3Util from '../Util';
import { TxStatus } from '../Enum';

export default class CacheScanner extends BaseScanner {
  public cacheInterval: IntervalId;
  public avgBlockTime: number;
  public util: W3Util;

  private routes: Set<string> = new Set<string>();

  constructor(config: Config, router: IRouter) {
    super(config, router);
    this.util = new W3Util();
  }

  public async scanCache(): Promise<void> {
    if (this.config.cache.isEmpty()) {
      return;
    }

    this.avgBlockTime = await this.util.getAverageBlockTime();

    let txRequests = this.getCacheTxRequests();
    const blockTransactions = txRequests.filter((tx: ITxRequest) => tx.temporalUnit === 1);
    const timestampTransactions = txRequests.filter((tx: ITxRequest) => tx.temporalUnit === 2);

    blockTransactions.sort(this.windowStartSort);
    blockTransactions.sort(this.higherBountySortIfInSameBlock);

    timestampTransactions.sort(this.windowStartSort);
    timestampTransactions.sort(this.higherBountySortIfInSameBlock);

    txRequests = blockTransactions.concat(timestampTransactions);

    txRequests.forEach((txRequest: ITxRequest) => this.route(txRequest));
  }

  private getCacheTxRequests(): ITxRequest[] {
    return this.config.cache
      .stored()
      .map(address => this.config.eac.transactionRequest(address))
      .sort((a, b) => this.prioritize(a, b));
  }

  private windowStartSort(currentTx: ITxRequest, nextTx: ITxRequest): number {
    if (currentTx.windowStart < nextTx.windowStart) {
      return -1;
    } else if (currentTx.windowStart > nextTx.windowStart) {
      return 1;
    }
    return 0;
  }

  private prioritize(a: ITxRequest, b: ITxRequest): number {
    const statusA = this.config.cache.get(a.address).status;
    const statusB = this.config.cache.get(b.address).status;

    if (statusA === statusB) {
      return 0;
    }

    return statusA === TxStatus.FreezePeriod && statusB !== TxStatus.FreezePeriod ? -1 : 1;
  }

  private higherBountySortIfInSameBlock(currentTx: ITxRequest, nextTx: ITxRequest): number {
    const blockTime = currentTx.temporalUnit === 1 ? 1 : this.avgBlockTime;

    const blockDifference = currentTx.windowStart.minus(nextTx.windowStart).abs();
    const isInSameBlock = blockDifference.lessThanOrEqualTo(blockTime);

    if (isInSameBlock) {
      if (currentTx.bounty < nextTx.bounty) {
        return -1;
      } else if (currentTx.bounty > nextTx.bounty) {
        return 1;
      }
    }

    return 0;
  }

  private async route(txRequest: ITxRequest): Promise<void> {
    const address = txRequest.address;
    if (!this.routes.has(address)) {
      this.routes.add(address);

      try {
        await txRequest.refreshData();
        await this.router.route(txRequest);
      } finally {
        this.routes.delete(address);
      }
    } else {
      this.config.logger.debug(`Routing in progress. Skipping...`, address);
    }
  }
}
