import { ILogger, DefaultLogger } from '../Logger';
import { Bucket } from '../Buckets';
import { BucketWatchCallback } from './BucketWatchCallback';
import { IBucketWatcher } from './IBucketWatcher';

export class WatchableBucket {
  private bucketNumber: Bucket;
  private watcher: any;
  private requestFactory: IBucketWatcher;
  private logger: ILogger;
  private callBack: BucketWatchCallback;

  constructor(
    bucket: Bucket,
    requestFactory: IBucketWatcher,
    callBack: BucketWatchCallback,
    logger: ILogger = new DefaultLogger()
  ) {
    this.bucketNumber = bucket;
    this.requestFactory = requestFactory;
    this.callBack = callBack;
    this.logger = logger;
  }

  public async watch() {
    if (this.watcher) {
      this.logger.debug(`WatchableBucket: Bucket ${this.bucketNumber} already watched.`);
      return;
    }
    await this.start();
  }

  public async stop() {
    try {
      if (this.watcher) {
        await this.requestFactory.stopWatch(this.watcher);
        this.watcher = null;

        this.logger.debug(`Buckets: Watcher for bucket=${this.bucketNumber} has been stopped`);
      }
    } catch (err) {
      this.logger.error(`Buckets: Stopping bucket=${this.bucketNumber} watching failed!`);
    }
  }

  public get bucket(): Bucket {
    return this.bucketNumber;
  }

  private async start() {
    try {
      const watcher = await this.requestFactory.watchRequestsByBucket(
        this.bucketNumber,
        this.callBack
      );
      this.watcher = watcher;

      this.logger.debug(`Buckets: Watcher for bucket=${this.bucketNumber} has been started`);
    } catch (err) {
      this.logger.error(`Buckets: Starting bucket=${this.bucketNumber} watching failed!`);
    }
  }
}
