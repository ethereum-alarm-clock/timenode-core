import { WatchableBucket } from './WatchableBucket';
import { IBucketWatcher } from './IBucketWatcher';
import { Bucket } from '../Buckets';
import { BucketWatchCallback } from './BucketWatchCallback';
import { ILogger } from '../Logger';

export class WatchableBucketFactory {
  private requestFactory: Promise<IBucketWatcher>;
  private logger: ILogger;

  constructor(requestFactory: Promise<IBucketWatcher>, logger: ILogger) {
    this.requestFactory = requestFactory;
    this.logger = logger;
  }

  public async create(bucket: Bucket, callback: BucketWatchCallback): Promise<WatchableBucket> {
    return new WatchableBucket(bucket, await this.requestFactory, callback, this.logger);
  }
}
