import { BucketWatchCallback } from './BucketWatchCallback';

export interface IBucketWatcher {
  watchRequestsByBucket(bucket: number, callBack: BucketWatchCallback): Promise<any>;
  stopWatch(watcher: any): Promise<void>;
}
