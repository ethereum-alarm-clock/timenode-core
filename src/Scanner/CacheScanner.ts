import BigNumber from 'bignumber.js';

import { IntervalId } from '../Types';
import BaseScanner from './BaseScanner';
import IRouter from '../Router';
import Config from '../Config';
import { TxStatus } from '../Enum';

import { ICachedTxDetails } from '../Cache';
import { ITransactionRequest } from '@ethereum-alarm-clock/lib';

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
    txRequests.forEach((txRequest: ITransactionRequest) => this.route(txRequest));
  }

  public getCacheTxRequests(): ITransactionRequest[] {
    return this.config.cache.stored().map(address => this.config.eac.transactionRequest(address));
  }

  /*
   *  Prioritizes transactions in the following order:
   *  1. Transactions in FreezePeriod come first
   *  2. Sorts sorted by windowStart
   *  3. If some 2 transactions have windowStart set to the same block,
   *     it sorts those by whichever has the highest bounty.
   */
  private prioritizeTransactions(txRequests: ITransactionRequest[]): ITransactionRequest[] {
    const getTxFromCache = (address: string) => this.config.cache.get(address);

    const blockTransactions = txRequests.filter(
      (tx: ITransactionRequest) => getTxFromCache(tx.address).temporalUnit === 1
    );
    const timestampTransactions = txRequests.filter(
      (tx: ITransactionRequest) => getTxFromCache(tx.address).temporalUnit === 2
    );

    blockTransactions.sort((currentTx, nextTx) =>
      this.claimWindowStartSort(
        getTxFromCache(currentTx.address).claimWindowStart,
        getTxFromCache(nextTx.address).claimWindowStart
      )
    );
    blockTransactions.sort((currentTx, nextTx) =>
      this.higherBountySortIfInSameBlock(
        getTxFromCache(currentTx.address),
        getTxFromCache(nextTx.address)
      )
    );

    timestampTransactions.sort((currentTx, nextTx) =>
      this.claimWindowStartSort(
        getTxFromCache(currentTx.address).claimWindowStart,
        getTxFromCache(nextTx.address).claimWindowStart
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

  private claimWindowStartSort(
    currentClaimWindowStart: BigNumber,
    nextClaimWindowStart: BigNumber
  ): number {
    if (currentClaimWindowStart.lessThan(nextClaimWindowStart)) {
      return -1;
    } else if (currentClaimWindowStart.greaterThan(nextClaimWindowStart)) {
      return 1;
    }
    return 0;
  }

  private prioritizeFreezePeriod(
    currentTx: ITransactionRequest,
    nextTx: ITransactionRequest
  ): number {
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

  private async route(txRequest: ITransactionRequest): Promise<void> {
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
