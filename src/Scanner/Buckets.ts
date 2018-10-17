import { WatchableBucket } from './WatchableBucket';
import { IBuckets, IBucketPair } from '../Buckets';
import { BucketWatchCallback } from './BucketWatchCallback';
import { WatchableBucketFactory } from './WatchableBucketFactory';

export class Buckets {
  private buckets: WatchableBucket[] = [];
  private watchableBucketFactory: WatchableBucketFactory;

  constructor(watchableBucketFactory: WatchableBucketFactory) {
    this.watchableBucketFactory = watchableBucketFactory;
  }

  public async update(newBuckets: IBuckets, callback: BucketWatchCallback) {
    if (this.stopped) {
      await this.addBucket(newBuckets.currentBuckets, callback);
      await this.addBucket(newBuckets.nextBuckets, callback);
      await this.addBucket(newBuckets.afterNextBuckets, callback);
    } else {
      if (this.currentBucket.equals(newBuckets.currentBuckets)) {
        return;
      }

      await this.shift();
      await this.addBucket(newBuckets.afterNextBuckets, callback);
    }
  }

  public async stop() {
    while (!this.stopped) {
      await this.shift();
    }
  }

  private async push(bucket: WatchableBucket) {
    await bucket.watch();
    this.buckets.push(bucket);
  }

  private async shift() {
    const bucket = this.buckets.shift();
    if (bucket) {
      await bucket.stop();
    }
  }

  private async addBucket(bucketPair: IBucketPair, callback: BucketWatchCallback) {
    const bucket = await this.watchableBucketFactory.create(bucketPair, callback);
    await this.push(bucket);
  }

  private get stopped() {
    return this.buckets.length === 0;
  }

  private get currentBucket(): WatchableBucket {
    return this.buckets[0];
  }
}
