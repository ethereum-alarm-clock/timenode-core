import * as TypeMoq from 'typemoq';
import { IBucketWatcher } from '../../src/Scanner/IBucketWatcher';
import { WatchableBucket } from '../../src/Scanner/WatchableBucket';
import { assert } from 'chai';

describe('WatchableBucket', () => {
  it('should not stop previous watch when there was not any started', async () => {
    const requestFactoryMock = TypeMoq.Mock.ofType<IBucketWatcher>();
    requestFactoryMock
      .setup(r => r.stopWatch(TypeMoq.It.isAny()))
      .verifiable(TypeMoq.Times.exactly(0));

    const bucket = {
      blockBucket: 0,
      timestampBucket: 1
    };

    const watchableBucket = new WatchableBucket(bucket, requestFactoryMock.object, null);

    await watchableBucket.stop();

    requestFactoryMock.verifyAll();
  });

  it('should stop previous watch if there was any started', async () => {
    const requestFactoryMock = TypeMoq.Mock.ofType<IBucketWatcher>();
    requestFactoryMock
      .setup(r => r.stopWatch(TypeMoq.It.isAny()))
      .verifiable(TypeMoq.Times.exactly(2));
    requestFactoryMock
      .setup(r => r.watchRequestsByBucket(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(value => value);

    const bucket = {
      blockBucket: 0,
      timestampBucket: 1
    };

    const watchableBucket = new WatchableBucket(bucket, requestFactoryMock.object, null);

    await watchableBucket.watch();
    await watchableBucket.stop();

    requestFactoryMock.verifyAll();
  });

  it('should not stop previous more than once', async () => {
    const requestFactoryMock = TypeMoq.Mock.ofType<IBucketWatcher>();
    requestFactoryMock
      .setup(r => r.stopWatch(TypeMoq.It.isAny()))
      .verifiable(TypeMoq.Times.exactly(2));
    requestFactoryMock
      .setup(r => r.watchRequestsByBucket(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(value => value);

    const bucket = {
      blockBucket: 0,
      timestampBucket: 1
    };

    const watchableBucket = new WatchableBucket(bucket, requestFactoryMock.object, null);

    await watchableBucket.watch();
    await watchableBucket.stop();
    await watchableBucket.stop();

    requestFactoryMock.verifyAll();
  });

  it('should compare', async () => {
    const bucketPair = {
      timestampBucket: 100,
      blockBucket: 102
    };

    const differentBucket = {
      timestampBucket: 101,
      blockBucket: 102
    };

    const differentBucket2 = {
      timestampBucket: 100,
      blockBucket: 101
    };

    const watchableBucket = new WatchableBucket(bucketPair, null, null);

    assert.isTrue(watchableBucket.equals(bucketPair));
    assert.isFalse(watchableBucket.equals(differentBucket));
    assert.isFalse(watchableBucket.equals(differentBucket2));
  });
});
