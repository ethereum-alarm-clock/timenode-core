import { WatchableBucket } from './WatchableBucket';
import { IBucketWatcher } from './IBucketWatcher';
import { IBucketPair } from '../Buckets';
import { BucketWatchCallback } from './BucketWatchCallback';
import { ILogger } from '../Logger';

export class WatchableBucketFactory {
  private requestFactory: Promise<IBucketWatcher>;
  private logger: ILogger;

  constructor(requestFactory: Promise<IBucketWatcher>, logger: ILogger) {
    this.requestFactory = requestFactory;
    this.logger = logger;
  }

  public async create(
    bucketPair: IBucketPair,
    callback: BucketWatchCallback
  ): Promise<WatchableBucket> {
    return new WatchableBucket(bucketPair, await this.requestFactory, callback, this.logger);
  }
}
