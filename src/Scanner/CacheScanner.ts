import BigNumber from 'bignumber.js';

import { IntervalId, Address, ITxRequest } from '../Types';
import BaseScanner from './BaseScanner';
import IRouter from '../Router';
import Config from '../Config';
import W3Util from '../Util';

export default class CacheScanner extends BaseScanner {
  public cacheInterval: IntervalId;
  private routes: Set<string> = new Set<string>();

  constructor(config: Config, router: IRouter) {
    super(config, router);
  }

  public async scanCache(): Promise<void> {
    if (this.config.cache.isEmpty()) {
      return;
    }

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
    return this.config.cache.stored()
      .filter((address: Address) => this.config.cache.get(address))
      .map((address: Address) => this.config.eac.transactionRequest(address));
  }

  private windowStartSort(currentTx: ITxRequest, nextTx: ITxRequest): number {
    if (currentTx.windowStart < nextTx.windowStart) {
      return -1;
    } else if (currentTx.windowStart > nextTx.windowStart) {
      return 1;
    }
    return 0;
  }

  private async higherBountySortIfInSameBlock(currentTx: ITxRequest, nextTx: ITxRequest): Promise<number> {

    let blockTime = 1;

    if (currentTx.temporalUnit === 2) {
      const util = new W3Util();
      blockTime = await util.getAverageBlockTime();
    }

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
