import { IBlock } from '../Types';
import { BucketSize } from '.';
import W3Util from '../Util';
import { Bucket } from './IBucketPair';

export interface IBucketCalc {
  getBuckets(): Promise<Bucket[]>;
}

export class BucketCalc {
  private requestFactory: Promise<any>;
  private util: W3Util;

  constructor(util: W3Util, requestFactory: any) {
    this.util = util;
    this.requestFactory = requestFactory;
  }

  public async getBuckets(): Promise<Bucket[]> {
    const latest: IBlock = await this.util.getBlock('latest');

    const currentBuckets = await this.getCurrentBuckets(latest);
    const nextBuckets = await this.getNextBuckets(latest);
    const afterNextBuckets = await this.getAfterNextBuckets(latest);

    return currentBuckets.concat(nextBuckets).concat(afterNextBuckets);
  }

  private async getCurrentBuckets(latest: IBlock): Promise<Bucket[]> {
    return [
      (await this.requestFactory).calcBucket(latest.number, 1),
      (await this.requestFactory).calcBucket(latest.timestamp, 2)
    ];
  }

  private async getNextBuckets(latest: IBlock): Promise<Bucket[]> {
    const nextBlockInterval = latest.number + BucketSize.block;
    const nextTsInterval = latest.timestamp + BucketSize.timestamp;

    return [
      (await this.requestFactory).calcBucket(nextBlockInterval, 1),
      (await this.requestFactory).calcBucket(nextTsInterval, 2)
    ];
  }

  private async getAfterNextBuckets(latest: IBlock): Promise<Bucket[]> {
    const nextBlockInterval = latest.number + 2 * BucketSize.block;
    const nextTsInterval = latest.timestamp + 2 * BucketSize.timestamp;

    return [
      (await this.requestFactory).calcBucket(nextBlockInterval, 1),
      (await this.requestFactory).calcBucket(nextTsInterval, 2)
    ];
  }
}
