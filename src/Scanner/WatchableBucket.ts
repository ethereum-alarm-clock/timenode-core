import { ILogger } from '../Logger';
import { ITxRequestRaw } from '../Types/ITxRequest';
import { IBucketPair, Bucket } from '../Buckets';
import { BucketWatchCallback } from './BucketWatchCallback';

export class WatchableBucket {
  private bucket: IBucketPair;
  private requestFactory: any;
  private logger: ILogger;
  private callBack: BucketWatchCallback;
  private eventWatchers: {} = {};

  constructor(
    bucket: IBucketPair,
    requestFactory: any,
    callBack: (request: ITxRequestRaw) => void,
    logger: ILogger
  ) {
    this.bucket = bucket;
    this.requestFactory = requestFactory;
    this.callBack = callBack;
    this.logger = logger;
  }

  public async watch() {
    await this.stop();

    await this.startWatcher(this.bucket.blockBucket);
    await this.startWatcher(this.bucket.timestampBucket);
  }

  public async stop() {
    await this.stopWatcher(this.bucket.blockBucket);
    await this.stopWatcher(this.bucket.timestampBucket);
  }

  public equals(newBucket: IBucketPair): boolean {
    return (
      newBucket.blockBucket === this.bucket.blockBucket &&
      newBucket.timestampBucket === this.bucket.timestampBucket
    );
  }

  private async startWatcher(bucket: Bucket): Promise<number> {
    const reqFactory = await this.requestFactory;
    try {
      const watcher = await reqFactory.watchRequestsByBucket(bucket, this.callBack);
      this.eventWatchers[bucket] = watcher;

      this.logger.debug(`Buckets: Watcher for bucket=${bucket} has been started`);
    } catch (err) {
      this.logger.error(`Buckets: Starting bucket=${bucket} watching failed!`);
    }

    return bucket;
  }

  private async stopWatcher(bucket: Bucket) {
    const reqFactory = await this.requestFactory;
    try {
      const watcher = this.eventWatchers[bucket];
      if (watcher !== undefined) {
        await reqFactory.stopWatch(watcher);
        delete this.eventWatchers[bucket];

        this.logger.debug(`Buckets: Watcher for bucket=${bucket} has been stopped`);
      }
    } catch (err) {
      this.logger.error(`Buckets: Stopping bucket=${bucket} watching failed!`);
    }
  }
}
