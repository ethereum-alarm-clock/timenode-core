import * as TypeMoq from 'typemoq';

import { WatchableBucketFactory } from '../../src/Scanner/WatchableBucketFactory';
import { WatchableBucket } from '../../src/Scanner/WatchableBucket';
import { Buckets } from '../../src/Scanner/Buckets';
import { IBuckets } from '../../src/Buckets';

describe('WatchableBucket', () => {
  it('should watch all buckets when used for the first time', async () => {
    const bucketsPairs = TypeMoq.Mock.ofType<IBuckets>();

    const watchableBucket = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucket.setup(w => w.watch()).verifiable(TypeMoq.Times.exactly(3));
    watchableBucket.setup((x: any) => x.then).returns(() => undefined);

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

    const watchableBucket = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucket.setup(w => w.watch()).verifiable(TypeMoq.Times.exactly(3));
    watchableBucket.setup(w => w.equals(TypeMoq.It.isAny())).returns(() => true);
    watchableBucket.setup((x: any) => x.then).returns(() => undefined);

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
    const bucketsPairs = TypeMoq.Mock.ofType<IBuckets>();
    bucketsPairs
      .setup(b => b.currentBuckets)
      .returns(() => ({ timestampBucket: 1, blockBucket: 10000 }));

    const bucketsPairs2 = TypeMoq.Mock.ofType<IBuckets>();
    bucketsPairs
      .setup(b => b.currentBuckets)
      .returns(() => ({ timestampBucket: 2, blockBucket: 10001 }));

    const watchableBucket = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucket.setup(w => w.watch()).verifiable(TypeMoq.Times.exactly(4));
    watchableBucket.setup(w => w.stop()).verifiable(TypeMoq.Times.exactly(1));
    watchableBucket.setup(w => w.equals(TypeMoq.It.isAny())).returns(() => false);
    watchableBucket.setup((x: any) => x.then).returns(() => undefined);

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    watchableBucketFactory
      .setup(r => r.create(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => watchableBucket.object)
      .verifiable(TypeMoq.Times.exactly(4));

    const buckets = new Buckets(watchableBucketFactory.object);

    await buckets.update(bucketsPairs.object, null);
    await buckets.update(bucketsPairs2.object, null);

    watchableBucket.verifyAll();
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
});
