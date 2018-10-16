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
    const currentBuckets = { timestampBucket: 0, blockBucket: 10000 };
    const currentBuckets2 = { timestampBucket: 2, blockBucket: 10001 };
    const afterNextBuckets = { timestampBucket: 3, blockBucket: 10002 };

    const bucketsPairs = TypeMoq.Mock.ofType<IBuckets>();
    bucketsPairs.setup(b => b.currentBuckets).returns(() => currentBuckets);

    const bucketsPairs2 = TypeMoq.Mock.ofType<IBuckets>();
    bucketsPairs.setup(b => b.currentBuckets).returns(() => currentBuckets2);
    bucketsPairs2.setup(b => b.afterNextBuckets).returns(() => afterNextBuckets);

    const watchableBucketForCurrentBuckets = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucketForCurrentBuckets.setup(w => w.watch()).verifiable(TypeMoq.Times.once());
    watchableBucketForCurrentBuckets.setup(w => w.stop()).verifiable(TypeMoq.Times.once());
    watchableBucketForCurrentBuckets.setup(w => w.equals(TypeMoq.It.isAny())).returns(() => false);
    watchableBucketForCurrentBuckets.setup((x: any) => x.then).returns(() => undefined);

    const watchableBucketForCurrentBuckets2 = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucketForCurrentBuckets2.setup(w => w.watch()).verifiable(TypeMoq.Times.never());
    watchableBucketForCurrentBuckets2.setup(w => w.stop()).verifiable(TypeMoq.Times.never());
    watchableBucketForCurrentBuckets2.setup((x: any) => x.then).returns(() => undefined);

    const watchableBucketForAfterNextBuckets = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucketForAfterNextBuckets.setup(w => w.watch()).verifiable(TypeMoq.Times.once());
    watchableBucketForAfterNextBuckets.setup(w => w.stop()).verifiable(TypeMoq.Times.never());
    watchableBucketForAfterNextBuckets.setup((x: any) => x.then).returns(() => undefined);

    const watchableBucketDefault = TypeMoq.Mock.ofType<WatchableBucket>();
    watchableBucketDefault.setup((x: any) => x.then).returns(() => undefined);

    const watchableBucketFactory = TypeMoq.Mock.ofType<WatchableBucketFactory>();
    watchableBucketFactory
      .setup(r => r.create(currentBuckets, TypeMoq.It.isAny()))
      .returns(async () => watchableBucketForCurrentBuckets.object)
      .verifiable(TypeMoq.Times.once());

    watchableBucketFactory
      .setup(r => r.create(currentBuckets2, TypeMoq.It.isAny()))
      .returns(async () => watchableBucketForCurrentBuckets2.object)
      .verifiable(TypeMoq.Times.never());

    watchableBucketFactory
      .setup(r => r.create(afterNextBuckets, TypeMoq.It.isAny()))
      .returns(async () => watchableBucketForAfterNextBuckets.object)
      .verifiable(TypeMoq.Times.once());

    watchableBucketFactory
      .setup(r => r.create(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(async () => watchableBucketDefault.object);

    const buckets = new Buckets(watchableBucketFactory.object);

    await buckets.update(bucketsPairs.object, null);
    await buckets.update(bucketsPairs2.object, null);

    watchableBucketForCurrentBuckets.verifyAll();
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
