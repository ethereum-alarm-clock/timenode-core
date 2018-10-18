import * as TypeMoq from 'typemoq';

import { WatchableBucketFactory } from '../../src/Scanner/WatchableBucketFactory';
import { WatchableBucket } from '../../src/Scanner/WatchableBucket';
import { Buckets } from '../../src/Scanner/Buckets';
import { IBuckets, IBucketPair } from '../../src/Buckets';

// tslint:disable-next-line:no-big-function
describe('WatchableBucket', () => {
  const createWatchableBucket = (
    timesWatch: TypeMoq.Times,
    timesStop: TypeMoq.Times,
    equals: boolean
  ) => {
    const watchableBucket = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucket.setup(w => w.watch()).verifiable(timesWatch);
    watchableBucket.setup(w => w.stop()).verifiable(timesStop);
    watchableBucket.setup(w => w.equals(TypeMoq.It.isAny())).returns(() => equals);
    watchableBucket.setup((x: any) => x.then).returns(() => undefined);

    return watchableBucket;
  };

  const registerInFactory = (
    watchableBucketFactoryMock: TypeMoq.IMock<WatchableBucketFactory>,
    bucketPair: IBucketPair,
    watchableBucketMock: TypeMoq.IMock<WatchableBucket>,
    times: TypeMoq.Times = TypeMoq.Times.once()
  ) => {
    watchableBucketFactoryMock
      .setup(r => r.create(bucketPair, TypeMoq.It.isAny()))
      .returns(async () => watchableBucketMock.object)
      .verifiable(times);
  };

  it('should watch all buckets when used for the first time', async () => {
    const bucketsPairs = TypeMoq.Mock.ofType<IBuckets>();

    const watchableBucket = createWatchableBucket(
      TypeMoq.Times.exactly(3),
      TypeMoq.Times.never(),
      false
    );

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    watchableBucketFactory
      .setup(r => r.create(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => watchableBucket.object)
      .verifiable(TypeMoq.Times.exactly(3));

    const buckets = new Buckets(watchableBucketFactory.object);

    await buckets.update(bucketsPairs.object, null);

    watchableBucket.verifyAll();
    watchableBucketFactory.verifyAll();
  });

  it('should not watch same buckets when already watched', async () => {
    const bucketsPairs = TypeMoq.Mock.ofType<IBuckets>();

    const watchableBucket = createWatchableBucket(
      TypeMoq.Times.exactly(3),
      TypeMoq.Times.never(),
      true
    );

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    watchableBucketFactory
      .setup(r => r.create(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => watchableBucket.object)
      .verifiable(TypeMoq.Times.exactly(3));

    const buckets = new Buckets(watchableBucketFactory.object);

    await buckets.update(bucketsPairs.object, null);
    await buckets.update(bucketsPairs.object, null);

    watchableBucket.verifyAll();
    watchableBucketFactory.verifyAll();
  });

  it('should shift buckets', async () => {
    const currentBuckets = { timestampBucket: 0, blockBucket: 10000 };
    const nextBuckets = { timestampBucket: 2, blockBucket: 10001 };
    const afterNextBuckets = { timestampBucket: 3, blockBucket: 10002 };

    const currentBuckets2 = nextBuckets;
    const afterNextBuckets2 = { timestampBucket: 4, blockBucket: 10003 };

    const bucketsPairs = {
      currentBuckets,
      nextBuckets,
      afterNextBuckets
    };
    const bucketsPairs2 = {
      currentBuckets: currentBuckets2,
      nextBuckets: afterNextBuckets,
      afterNextBuckets: afterNextBuckets2
    };

    const watchableBucketForCurrentBuckets = createWatchableBucket(
      TypeMoq.Times.once(),
      TypeMoq.Times.once(),
      false
    );
    const watchableBucketForCurrentBuckets2 = createWatchableBucket(
      TypeMoq.Times.once(),
      TypeMoq.Times.never(),
      true
    );
    const watchableBucketForAfterNextBuckets = createWatchableBucket(
      TypeMoq.Times.once(),
      TypeMoq.Times.never(),
      false
    );

    const watchableBucketDefault = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucketDefault.setup((x: any) => x.then).returns(() => undefined);

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    registerInFactory(watchableBucketFactory, currentBuckets, watchableBucketForCurrentBuckets);
    registerInFactory(watchableBucketFactory, nextBuckets, watchableBucketForCurrentBuckets2);
    registerInFactory(
      watchableBucketFactory,
      afterNextBuckets2,
      watchableBucketForAfterNextBuckets
    );

    watchableBucketFactory
      .setup(r => r.create(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => watchableBucketDefault.object);

    const buckets = new Buckets(watchableBucketFactory.object);

    await buckets.update(bucketsPairs, null);
    await buckets.update(bucketsPairs2, null);

    watchableBucketForCurrentBuckets.verifyAll();
    watchableBucketForCurrentBuckets2.verifyAll();
    watchableBucketForAfterNextBuckets.verifyAll();

    watchableBucketFactory.verifyAll();
  });

  it('should stop all buckets when requested', async () => {
    const bucketsPairs = TypeMoq.Mock.ofType<IBuckets>();

    const watchableBucket = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucket.setup(w => w.stop()).verifiable(TypeMoq.Times.exactly(3));
    watchableBucket.setup((x: any) => x.then).returns(() => undefined);

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    watchableBucketFactory
      .setup(r => r.create(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => watchableBucket.object);

    const buckets = new Buckets(watchableBucketFactory.object);

    await buckets.update(bucketsPairs.object, null);
    await buckets.stop();

    watchableBucket.verifyAll();
  });

  it('should restart all buckets when one of the buckets has changed', async () => {
    const currentBuckets = { timestampBucket: 0, blockBucket: 10000 };
    const nextBuckets = { timestampBucket: 2, blockBucket: 10001 };
    const afterNextBuckets = { timestampBucket: 3, blockBucket: 10002 };

    const currentBuckets2 = { timestampBucket: 2, blockBucket: 10006 };
    const nextBuckets2 = { timestampBucket: 3, blockBucket: 10007 };
    const afterNextBuckets2 = { timestampBucket: 4, blockBucket: 10008 };

    const bucketsPairs = {
      currentBuckets,
      nextBuckets,
      afterNextBuckets
    };
    const bucketsPairs2 = {
      currentBuckets: currentBuckets2,
      nextBuckets: nextBuckets2,
      afterNextBuckets: afterNextBuckets2
    };

    const watchableBucketForCurrentBuckets = createWatchableBucket(
      TypeMoq.Times.once(),
      TypeMoq.Times.once(),
      false
    );
    const watchableBucketForNextBuckets = createWatchableBucket(
      TypeMoq.Times.once(),
      TypeMoq.Times.once(),
      false
    );
    const watchableBucketForAfterNextBuckets = createWatchableBucket(
      TypeMoq.Times.once(),
      TypeMoq.Times.once(),
      false
    );

    const watchableBucketForCurrentBuckets2 = createWatchableBucket(
      TypeMoq.Times.once(),
      TypeMoq.Times.never(),
      false
    );
    const watchableBucketForNextBuckets2 = createWatchableBucket(
      TypeMoq.Times.once(),
      TypeMoq.Times.never(),
      false
    );
    const watchableBucketForAfterNextBuckets2 = createWatchableBucket(
      TypeMoq.Times.once(),
      TypeMoq.Times.never(),
      false
    );

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    registerInFactory(watchableBucketFactory, currentBuckets, watchableBucketForCurrentBuckets);
    registerInFactory(watchableBucketFactory, nextBuckets, watchableBucketForNextBuckets);
    registerInFactory(watchableBucketFactory, afterNextBuckets, watchableBucketForAfterNextBuckets);

    registerInFactory(watchableBucketFactory, currentBuckets2, watchableBucketForCurrentBuckets2);
    registerInFactory(watchableBucketFactory, nextBuckets2, watchableBucketForNextBuckets2);
    registerInFactory(
      watchableBucketFactory,
      afterNextBuckets2,
      watchableBucketForAfterNextBuckets2
    );

    const buckets = new Buckets(watchableBucketFactory.object);

    await buckets.update(bucketsPairs, null);
    await buckets.update(bucketsPairs2, null);

    watchableBucketForCurrentBuckets.verifyAll();
    watchableBucketForNextBuckets.verifyAll();
    watchableBucketForAfterNextBuckets.verifyAll();

    watchableBucketForCurrentBuckets2.verifyAll();
    watchableBucketForNextBuckets2.verifyAll();
    watchableBucketForAfterNextBuckets2.verifyAll();

    watchableBucketFactory.verifyAll();
  });
});
