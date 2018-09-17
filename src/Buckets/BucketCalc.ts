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
      currentBuckets: this.getCurrentBuckets(latest),
      nextBuckets: this.getNextBuckets(latest)
    };
  }

  private getCurrentBuckets(latest: IBlock): IBucketPair {
    return {
      blockBucket: this.requestFactory.calcBucket(latest.number, 1),
      timestampBucket: this.requestFactory.calcBucket(latest.timestamp, 2)
    };
  }

  private getNextBuckets(latest: IBlock): IBucketPair {
    const nextBlockInterval = latest.number + BucketSize.block;
    const nextTsInterval = latest.timestamp + BucketSize.timestamp;

    return {
      blockBucket: this.requestFactory.calcBucket(nextBlockInterval, 1),
      timestampBucket: this.requestFactory.calcBucket(nextTsInterval, 2)
    };
  }
}
