import BigNumber from 'bignumber.js';

import { IntervalId, ITxRequest } from '../Types';
import BaseScanner from './BaseScanner';
import IRouter from '../Router';
import Config from '../Config';
import { TxStatus } from '../Enum';

import { ICachedTxDetails } from '../Cache';

export default class CacheScanner extends BaseScanner {
  public cacheInterval: IntervalId;
  public avgBlockTime: number;

  private routes: Set<string> = new Set<string>();

  constructor(config: Config, router: IRouter) {
    super(config, router);
  }

  public async scanCache(): Promise<void> {
    if (this.config.cache.isEmpty()) {
      return;
    }

    this.avgBlockTime = await this.config.util.getAverageBlockTime();

    let txRequests = this.getCacheTxRequests();
    txRequests = this.prioritizeTransactions(txRequests);
    txRequests.forEach((txRequest: ITxRequest) => this.route(txRequest));
  }

  public getCacheTxRequests(): ITxRequest[] {
    return this.config.cache.stored().map(address => this.config.eac.transactionRequest(address));
  }

  /*
   *  Prioritizes transactions in the following order:
   *  1. Transactions in FreezePeriod come first
   *  2. Sorts sorted by windowStart
   *  3. If some 2 transactions have windowStart set to the same block,
   *     it sorts those by whichever has the highest bounty.
   */
  private prioritizeTransactions(txRequests: ITxRequest[]): ITxRequest[] {
    const getTxFromCache = (address: string) => this.config.cache.get(address);

    const blockTransactions = txRequests.filter(
      (tx: ITxRequest) => getTxFromCache(tx.address).temporalUnit === 1
    );
    const timestampTransactions = txRequests.filter(
      (tx: ITxRequest) => getTxFromCache(tx.address).temporalUnit === 2
    );

    blockTransactions.sort((currentTx, nextTx) =>
      this.windowStartSort(
        getTxFromCache(currentTx.address).windowStart,
        getTxFromCache(nextTx.address).windowStart
      )
    );
    blockTransactions.sort((currentTx, nextTx) =>
      this.higherBountySortIfInSameBlock(
        getTxFromCache(currentTx.address),
        getTxFromCache(nextTx.address)
      )
    );

    timestampTransactions.sort((currentTx, nextTx) =>
      this.windowStartSort(
        getTxFromCache(currentTx.address).windowStart,
        getTxFromCache(nextTx.address).windowStart
      )
    );
    timestampTransactions.sort((currentTx, nextTx) =>
      this.higherBountySortIfInSameBlock(
        getTxFromCache(currentTx.address),
        getTxFromCache(nextTx.address)
      )
    );

    txRequests = blockTransactions
      .concat(timestampTransactions)
      .sort((currentTx, nextTx) => this.prioritizeFreezePeriod(currentTx, nextTx));

    return txRequests;
  }

  private windowStartSort(currentWindowStart: BigNumber, nextWindowStart: BigNumber): number {
    if (currentWindowStart.lessThan(nextWindowStart)) {
      return -1;
    } else if (currentWindowStart.greaterThan(nextWindowStart)) {
      return 1;
    }
    return 0;
  }

  private prioritizeFreezePeriod(currentTx: ITxRequest, nextTx: ITxRequest): number {
    const statusA = this.config.cache.get(currentTx.address).status;
    const statusB = this.config.cache.get(nextTx.address).status;

    if (statusA === statusB) {
      return 0;
    }

    return statusA === TxStatus.FreezePeriod && statusB !== TxStatus.FreezePeriod ? -1 : 1;
  }

  private higherBountySortIfInSameBlock(
    currentTx: ICachedTxDetails,
    nextTx: ICachedTxDetails
  ): number {
    const blockTime = currentTx.temporalUnit === 1 ? 1 : this.avgBlockTime;

    const blockDifference = currentTx.windowStart.minus(nextTx.windowStart).abs();
    const isInSameBlock = blockDifference.lessThanOrEqualTo(blockTime);

    if (isInSameBlock) {
      if (currentTx.bounty.lessThan(nextTx.bounty)) {
        return 1;
      } else if (currentTx.bounty.greaterThan(nextTx.bounty)) {
        return -1;
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
