import { IBlock, IntervalId, ITxRequest } from '../Types';
import { Bucket, IBucketPair, IBuckets, BucketSize } from '.';
import { Config } from '..';

export interface IBucketCalc {
  getBuckets(): Promise<IBuckets>
}

export class BucketCalc {
  private requestFactory: any
  private config: Config
  constructor(config: Config, requestFactory: any){
    this.config = config;
    this.requestFactory = requestFactory;
  }

  public async getBuckets(): Promise<IBuckets> {
    const latest: IBlock = await this.config.util.getBlock('latest');
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