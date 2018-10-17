import { assert, expect } from 'chai';
import * as TypeMoq from 'typemoq';

import { W3Util } from '../../src';
import { BucketCalc, BucketSize } from '../../src/Buckets';
import { IBlock } from '../../src/Types';
import { mockConfig } from '../helpers';

describe('ButcketCalc', () => {
  describe('getBuckets()', async () => {
    it('returns current, next and after next buckets', async () => {
      const defaultBlock: IBlock = { number: 10000, timestamp: 10000000000 };
      const util = TypeMoq.Mock.ofType<W3Util>();
      util.setup(u => u.getBlock('latest')).returns(async () => defaultBlock);

      const config = await mockConfig();
      const requestFactory = config.eac.requestFactory();

      const bucketCalc = new BucketCalc(util.object, requestFactory);

      const { currentBuckets, nextBuckets, afterNextBuckets } = await bucketCalc.getBuckets();

      expect(currentBuckets).to.haveOwnProperty('blockBucket');
      expect(currentBuckets).to.haveOwnProperty('timestampBucket');
      expect(nextBuckets).to.haveOwnProperty('blockBucket');
      expect(nextBuckets).to.haveOwnProperty('timestampBucket');
      expect(afterNextBuckets).to.haveOwnProperty('blockBucket');
      expect(afterNextBuckets).to.haveOwnProperty('timestampBucket');

      assert.equal(
        currentBuckets.blockBucket,
        -1 * (defaultBlock.number - (defaultBlock.number % BucketSize.block))
      );
      assert.equal(
        currentBuckets.timestampBucket,
        defaultBlock.timestamp - (defaultBlock.timestamp % BucketSize.timestamp)
      );

      const expectedNextBlockInterval = defaultBlock.number + BucketSize.block;
      const expectedNextTimestampInterval = defaultBlock.timestamp + BucketSize.timestamp;
      assert.equal(
        nextBuckets.blockBucket,
        -1 * (expectedNextBlockInterval - (expectedNextBlockInterval % BucketSize.block))
      );
      assert.equal(
        nextBuckets.timestampBucket,
        expectedNextTimestampInterval - (expectedNextTimestampInterval % BucketSize.timestamp)
      );

      const expectedAfterNextBlockInterval = defaultBlock.number + 2 * BucketSize.block;
      const expectedAfterNextTimestampInterval = defaultBlock.timestamp + 2 * BucketSize.timestamp;
      assert.equal(
        afterNextBuckets.blockBucket,
        -1 * (expectedAfterNextBlockInterval - (expectedAfterNextBlockInterval % BucketSize.block))
      );
      assert.equal(
        afterNextBuckets.timestampBucket,
        expectedAfterNextTimestampInterval -
          (expectedAfterNextTimestampInterval % BucketSize.timestamp)
      );
    });
  });
});
