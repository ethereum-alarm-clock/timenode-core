import { assert, expect } from 'chai';
import * as TypeMoq from 'typemoq';

import { Config, W3Util } from '../../src';
import { BucketCalc, BucketSize, IBucketCalc } from '../../src/Buckets';
import { IBlock } from '../../src/Types';
import { mockConfig } from '../helpers';

describe('ButcketCalc', () => {
  let config: Config;
  let bucketCalc: IBucketCalc;

  const defaultBlock: IBlock = { number: 10000, timestamp: 10000000000 };
  const util = TypeMoq.Mock.ofType<W3Util>();
  util.setup(u => u.getBlock('latest')).returns(() => Promise.resolve(defaultBlock));

  const reset = async () => {
    config = await mockConfig();
    bucketCalc = new BucketCalc(util.object, config.eac.requestFactory);
  };

  beforeEach(reset);
  describe('getBuckets()', () => {
    it('returns current and next buckets', async () => {
      const { currentBuckets, nextBuckets } = await bucketCalc.getBuckets();

      expect(currentBuckets).to.haveOwnProperty('blockBucket');
      expect(currentBuckets).to.haveOwnProperty('timestampBucket');
      expect(nextBuckets).to.haveOwnProperty('blockBucket');
      expect(nextBuckets).to.haveOwnProperty('timestampBucket');

      assert.equal(
        currentBuckets.blockBucket,
        -1 * (defaultBlock.number - (defaultBlock.number % BucketSize.block))
      );
      assert.equal(
        currentBuckets.timestampBucket,
        defaultBlock.timestamp - (defaultBlock.timestamp % BucketSize.timestamp)
      );

      const expectedBlockInterval = defaultBlock.number + BucketSize.block;
      const expectedTimestampInterval = defaultBlock.timestamp + BucketSize.timestamp;
      assert.equal(
        nextBuckets.blockBucket,
        -1 * (expectedBlockInterval - (expectedBlockInterval % BucketSize.block))
      );
      assert.equal(
        nextBuckets.timestampBucket,
        expectedTimestampInterval - (expectedTimestampInterval % BucketSize.timestamp)
      );
    });
  });
});
