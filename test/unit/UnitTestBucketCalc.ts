import { assert } from 'chai';
import * as TypeMoq from 'typemoq';
import { BucketCalc, BucketSize } from '../../src/Buckets';
import { mockConfig } from '../helpers';
import { Block } from 'web3/eth/types';
import { Util } from '@ethereum-alarm-clock/lib';

describe('ButcketCalc', () => {
  describe('getBuckets()', async () => {
    it('returns current, next and after next buckets', async () => {
      const defaultBlock: Block = { number: 10000, timestamp: 10000000000 } as Block;
      const util = TypeMoq.Mock.ofType<Util>();
      util.setup(u => u.getBlock('latest')).returns(async () => defaultBlock);

      const config = await mockConfig();
      const requestFactory = config.eac.requestFactory();

      const bucketCalc = new BucketCalc(util.object, requestFactory);

      const buckets = await bucketCalc.getBuckets();

      assert.equal(buckets.length, 6);

      assert.include(
        buckets,
        -1 * (defaultBlock.number - (defaultBlock.number % BucketSize.block))
      );

      assert.include(
        buckets,
        defaultBlock.timestamp - (defaultBlock.timestamp % BucketSize.timestamp)
      );

      const expectedNextBlockInterval = defaultBlock.number + BucketSize.block;
      const expectedNextTimestampInterval = defaultBlock.timestamp + BucketSize.timestamp;
      assert.include(
        buckets,
        -1 * (expectedNextBlockInterval - (expectedNextBlockInterval % BucketSize.block))
      );
      assert.include(
        buckets,
        expectedNextTimestampInterval - (expectedNextTimestampInterval % BucketSize.timestamp)
      );

      const expectedAfterNextBlockInterval = defaultBlock.number + 2 * BucketSize.block;
      const expectedAfterNextTimestampInterval = defaultBlock.timestamp + 2 * BucketSize.timestamp;
      assert.include(
        buckets,
        -1 * (expectedAfterNextBlockInterval - (expectedAfterNextBlockInterval % BucketSize.block))
      );
      assert.include(
        buckets,
        expectedAfterNextTimestampInterval -
          (expectedAfterNextTimestampInterval % BucketSize.timestamp)
      );
    });
  });
});
