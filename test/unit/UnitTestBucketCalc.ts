import { expect, assert } from 'chai';
import BigNumber from 'bignumber.js';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequest, mockTxStatus } from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';
import Scanner from '../../src/Scanner';
import { TxStatus, CacheStates } from '../../src/Enum';
import { BucketSize } from '../../src/Buckets';
import { ITxRequest } from '../../src/Types';
describe('ButcketCalc', () => {
  let txBlock: ITxRequest;
  let config: Config;
  let txTimestamp: ITxRequest;

  let router: Router;
  let actions: Actions;
  let scanner: Scanner;

  const reset = async () => {
    config = await mockConfig();
    txTimestamp = await MockTxRequest(config.web3);
    txBlock = await MockTxRequest(config.web3, true);

    actions = new Actions(config);
    router = new Router(config, actions);
    scanner = new Scanner(config, router);
  };

  beforeEach(reset);
  describe('getBuckets()', () => {
    it('returns current and next buckets', async () => {
      const { currentBuckets, nextBuckets } = await scanner.bucketCalc.getBuckets();

      expect(currentBuckets).to.haveOwnProperty('blockBucket');
      expect(currentBuckets).to.haveOwnProperty('timestampBucket');
      expect(nextBuckets).to.haveOwnProperty('blockBucket');
      expect(nextBuckets).to.haveOwnProperty('timestampBucket');

      const block = {
        number: (await txBlock.now()).toNumber(),
        timestamp: (await txTimestamp.now()).toNumber()
      };

      assert.equal(
        currentBuckets.blockBucket,
        -1 * (block.number - (block.number % BucketSize.block))
      );
      assert.equal(
        currentBuckets.timestampBucket,
        block.timestamp - (block.timestamp % BucketSize.timestamp)
      );

      const expectedBlockInterval = block.number + BucketSize.block;
      const expectedTimestampInterval = block.timestamp + BucketSize.timestamp;
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
