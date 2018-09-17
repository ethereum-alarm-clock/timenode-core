import { IBlock } from '../Types';
import { IBucketPair, IBuckets, BucketSize } from '.';
import W3Util from '../Util';

export interface IBucketCalc {
  getBuckets(): Promise<IBuckets>;
}

export class BucketCalc {
  private requestFactory: Promise<any>;
  private util: W3Util;

  constructor(util: W3Util, requestFactory: any) {
    this.util = util;
    this.requestFactory = requestFactory;
  }

  public async getBuckets(): Promise<IBuckets> {
    const latest: IBlock = await this.util.getBlock('latest');
    return {
      currentBuckets: await this.getCurrentBuckets(latest),
      nextBuckets: await this.getNextBuckets(latest)
    };
  }

  private async getCurrentBuckets(latest: IBlock): Promise<IBucketPair> {
    return {
      blockBucket: (await this.requestFactory).calcBucket(latest.number, 1),
      timestampBucket: (await this.requestFactory).calcBucket(latest.timestamp, 2)
    };
  }

  private async getNextBuckets(latest: IBlock): Promise<IBucketPair> {
    const nextBlockInterval = latest.number + BucketSize.block;
    const nextTsInterval = latest.timestamp + BucketSize.timestamp;

    return {
      blockBucket: (await this.requestFactory).calcBucket(nextBlockInterval, 1),
      timestampBucket: (await this.requestFactory).calcBucket(nextTsInterval, 2)
    };
  }
}
