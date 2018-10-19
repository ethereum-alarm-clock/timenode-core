import { WatchableBucket } from './WatchableBucket';
import { Bucket } from '../Buckets';
import { BucketWatchCallback } from './BucketWatchCallback';
import { WatchableBucketFactory } from './WatchableBucketFactory';
import { ILogger, DefaultLogger } from '../Logger';

export class BucketsManager {
  private buckets: WatchableBucket[] = [];
  private watchableBucketFactory: WatchableBucketFactory;
  private logger: ILogger;

  constructor(
    watchableBucketFactory: WatchableBucketFactory,
    logger: ILogger = new DefaultLogger()
  ) {
    this.watchableBucketFactory = watchableBucketFactory;
    this.logger = logger;
  }

  public async stop() {
    await Promise.all(this.buckets.map(b => b.stop()));
    return;
  }

  public async update(buckets: Bucket[], callback: BucketWatchCallback) {
    this.logger.debug(`Buckets: updating with ${buckets}`);

    const toStart = await Promise.all(
      buckets
        .filter(b => !this.knownBucket(b))
        .map(b => this.watchableBucketFactory.create(b, callback))
    );
    const toSkip = this.buckets.filter(b => buckets.indexOf(b.bucket) > -1);
    const toStop = this.buckets.filter(b => buckets.indexOf(b.bucket) === -1);

    const starting = toStart.map(b => b.watch());
    const stopping = toStop.map(b => b.stop());

    await Promise.all(starting);
    await Promise.all(stopping);

    this.buckets = toSkip.concat(toStart);

    this.logger.debug(`Buckets: updated ${this.buckets.map(b => b.bucket)}`);
  }

  private knownBucket(bucket: Bucket): boolean {
    return this.buckets.some(b => b.bucket === bucket);
  }
}
