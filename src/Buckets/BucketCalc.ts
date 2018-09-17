import { IBlock } from '../Types';
import { IBucketPair, IBuckets, BucketSize } from '.';
import W3Util from '../Util';

export interface IBucketCalc {
  getBuckets(): Promise<IBuckets>;
}

export class BucketCalc {
  private requestFactory: any;
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
    const reqFactory = await this.requestFactory;

    return {
      blockBucket: reqFactory.calcBucket(latest.number, 1),
      timestampBucket: reqFactory.calcBucket(latest.timestamp, 2)
    };
  }

  private async getNextBuckets(latest: IBlock): Promise<IBucketPair> {
    const reqFactory = await this.requestFactory;
    const nextBlockInterval = latest.number + BucketSize.block;
    const nextTsInterval = latest.timestamp + BucketSize.timestamp;

    return {
      blockBucket: reqFactory.calcBucket(nextBlockInterval, 1),
      timestampBucket: reqFactory.calcBucket(nextTsInterval, 2)
    };
  }
}
