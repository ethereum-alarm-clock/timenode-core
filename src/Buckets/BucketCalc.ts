import { BucketSize } from '.';
import { Bucket } from './IBucketPair';
import RequestFactory from '@ethereum-alarm-clock/lib/built/requestFactory/RequestFactory';
import { Block } from 'web3/eth/types';
import { Util } from '@ethereum-alarm-clock/lib';

export interface IBucketCalc {
  getBuckets(): Promise<Bucket[]>;
}

export class BucketCalc {
  private requestFactory: Promise<RequestFactory>;
  private util: Util;

  constructor(util: Util, requestFactory: Promise<RequestFactory>) {
    this.util = util;
    this.requestFactory = requestFactory;
  }

  public async getBuckets(): Promise<Bucket[]> {
    const latest: Block = await this.util.getBlock('latest');

    const currentBuckets = await this.getCurrentBuckets(latest);
    const nextBuckets = await this.getNextBuckets(latest);
    const afterNextBuckets = await this.getAfterNextBuckets(latest);

    return currentBuckets.concat(nextBuckets).concat(afterNextBuckets);
  }

  private async getCurrentBuckets(latest: Block): Promise<Bucket[]> {
    return [
      (await this.requestFactory).calcBucket(latest.number, 1),
      (await this.requestFactory).calcBucket(latest.timestamp, 2)
    ];
  }

  private async getNextBuckets(latest: Block): Promise<Bucket[]> {
    const nextBlockInterval = latest.number + BucketSize.block;
    const nextTsInterval = latest.timestamp + BucketSize.timestamp;

    return [
      (await this.requestFactory).calcBucket(nextBlockInterval, 1),
      (await this.requestFactory).calcBucket(nextTsInterval, 2)
    ];
  }

  private async getAfterNextBuckets(latest: Block): Promise<Bucket[]> {
    const nextBlockInterval = latest.number + 2 * BucketSize.block;
    const nextTsInterval = latest.timestamp + 2 * BucketSize.timestamp;

    return [
      (await this.requestFactory).calcBucket(nextBlockInterval, 1),
      (await this.requestFactory).calcBucket(nextTsInterval, 2)
    ];
  }
}
