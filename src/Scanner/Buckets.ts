import { WatchableBucket } from './WatchableBucket';
import { IBuckets, IBucketPair } from '../Buckets';
import { BucketWatchCallback } from './BucketWatchCallback';
import { WatchableBucketFactory } from './WatchableBucketFactory';
import { ILogger, DefaultLogger } from '../Logger';

export class Buckets {
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

  public async update(newBuckets: IBuckets, callback: BucketWatchCallback) {
    if (this.stopped) {
      await this.add(newBuckets, callback);
    } else {
      if (this.currentBucket.equals(newBuckets.currentBuckets)) {
        return;
      } else if (this.nextBucket.equals(newBuckets.currentBuckets)) {
        await this.shift();
        await this.addBucket(newBuckets.afterNextBuckets, callback);
      } else {
        await this.stop();
        await this.add(newBuckets, callback);
      }
    }
  }

  public async stop() {
    while (!this.stopped) {
      await this.shift();
    }
  }

  private async add(newBuckets: IBuckets, callback: BucketWatchCallback) {
    await this.addBucket(newBuckets.currentBuckets, callback);
    await this.addBucket(newBuckets.nextBuckets, callback);
    await this.addBucket(newBuckets.afterNextBuckets, callback);
  }

  private async push(bucket: WatchableBucket) {
    await bucket.watch();
    this.buckets.push(bucket);
  }

  private async shift() {
    this.logger.debug(`Buckets: Shifting currentBucket`);
    const bucket = this.buckets.shift();

    if (bucket) {
      await bucket.stop();
    }
  }

  private async addBucket(bucketPair: IBucketPair, callback: BucketWatchCallback) {
    this.logger.debug(`Buckets: Adding new bucket ${JSON.stringify(bucketPair)}`);
    const bucket = await this.watchableBucketFactory.create(bucketPair, callback);
    await this.push(bucket);
  }

  private get stopped() {
    return this.buckets.length === 0;
  }

  private get currentBucket(): WatchableBucket {
    return this.buckets[0];
  }

  private get nextBucket(): WatchableBucket {
    return this.buckets[1];
  }
}
