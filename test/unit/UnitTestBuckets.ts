import * as TypeMoq from 'typemoq';

import { Bucket } from '../../src/Buckets';
import { BucketsManager } from '../../src/Scanner/BucketsManager';
import { WatchableBucket } from '../../src/Scanner/WatchableBucket';
import { WatchableBucketFactory } from '../../src/Scanner/WatchableBucketFactory';

// tslint:disable-next-line:no-big-function
describe('WatchableBucket', () => {
  const createWatchableBucket = (
    timesWatch: TypeMoq.Times,
    timesStop: TypeMoq.Times,
    bucket: Bucket = 0
  ) => {
    const watchableBucket = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucket.setup(w => w.watch()).verifiable(timesWatch);
    watchableBucket.setup(w => w.stop()).verifiable(timesStop);
    watchableBucket.setup(w => w.bucket).returns(() => bucket);
    watchableBucket.setup((x: any) => x.then).returns(() => undefined);

    return watchableBucket;
  };

  const registerInFactory = (
    watchableBucketFactoryMock: TypeMoq.IMock<WatchableBucketFactory>,
    bucket: Bucket,
    watchableBucketMock: TypeMoq.IMock<WatchableBucket>,
    times: TypeMoq.Times = TypeMoq.Times.once()
  ) => {
    watchableBucketFactoryMock
      .setup(r => r.create(bucket, TypeMoq.It.isAny()))
      .returns(async () => watchableBucketMock.object)
      .verifiable(times);
  };

  it('should watch all buckets when used for the first time', async () => {
    const buckets = [1, 2, 3, -1, -2, -3];
    const expectedStarts = TypeMoq.Times.exactly(buckets.length);

    const watchableBucket = createWatchableBucket(expectedStarts, TypeMoq.Times.never());

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    watchableBucketFactory
      .setup(r => r.create(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => watchableBucket.object)
      .verifiable(expectedStarts);

    const bucketsManager = new BucketsManager(watchableBucketFactory.object);

    await bucketsManager.update(buckets, null);

    watchableBucket.verifyAll();
    watchableBucketFactory.verifyAll();
  });

  it('should not watch same buckets when already watched', async () => {
    const buckets = [1, 2, 3, -1, -2, -3];
    const watchableBuckets = buckets.map(b =>
      createWatchableBucket(TypeMoq.Times.once(), TypeMoq.Times.never(), b)
    );

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    watchableBuckets.forEach(w => registerInFactory(watchableBucketFactory, w.object.bucket, w));

    const bucketsManager = new BucketsManager(watchableBucketFactory.object);

    await bucketsManager.update(buckets, null);
    await bucketsManager.update(buckets, null);

    watchableBuckets.forEach(w => w.verifyAll());
    watchableBucketFactory.verifyAll();
  });

  it('should stop old buckets', async () => {
    const bucket1 = 1;
    const bucket2 = 2;
    const bucket3 = 3;
    const bucket4 = -5;

    const toStop = [bucket1, bucket2];
    const toSkip = [bucket3, bucket4];

    const buckets = toStop.concat(toSkip);
    const newBuckets = toSkip;

    const watchableToStop = toStop.map(b =>
      createWatchableBucket(TypeMoq.Times.once(), TypeMoq.Times.once(), b)
    );
    const watchableToSkip = toSkip.map(b =>
      createWatchableBucket(TypeMoq.Times.once(), TypeMoq.Times.never(), b)
    );
    const watchable = watchableToStop.concat(watchableToSkip);

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    watchable.forEach(w => registerInFactory(watchableBucketFactory, w.object.bucket, w));

    const bucketsManager = new BucketsManager(watchableBucketFactory.object);

    await bucketsManager.update(buckets, null);
    await bucketsManager.update(newBuckets, null);

    watchable.forEach(w => w.verifyAll());
    watchableBucketFactory.verifyAll();
  });

  it('should start new buckets', async () => {
    const bucket1 = 1;
    const bucket2 = 2;
    const bucket3 = 3;
    const bucket4 = -5;

    const toStart = [bucket1, bucket2];
    const toSkip = [bucket3, bucket4];

    const buckets = toSkip;
    const newBuckets = toSkip.concat(toStart);

    const watchableToStop = toStart.map(b =>
      createWatchableBucket(TypeMoq.Times.once(), TypeMoq.Times.never(), b)
    );
    const watchableToSkip = toSkip.map(b =>
      createWatchableBucket(TypeMoq.Times.once(), TypeMoq.Times.never(), b)
    );
    const watchable = watchableToStop.concat(watchableToSkip);

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    watchable.forEach(w => registerInFactory(watchableBucketFactory, w.object.bucket, w));

    const bucketsManager = new BucketsManager(watchableBucketFactory.object);

    await bucketsManager.update(buckets, null);
    await bucketsManager.update(newBuckets, null);

    watchable.forEach(w => w.verifyAll());
    watchableBucketFactory.verifyAll();
  });
});
