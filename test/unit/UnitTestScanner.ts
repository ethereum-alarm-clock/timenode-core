/* tslint:disable:no-unused-expression */
import BigNumber from 'bignumber.js';
import { assert, expect } from 'chai';
import * as TypeMoq from 'typemoq';

import { Config } from '../../src';
import { BucketSize } from '../../src/Buckets';
import { CacheStates } from '../../src/Enum';
import IRouter from '../../src/Router';
import Scanner from '../../src/Scanner';
import { ITxRequest } from '../../src/Types';
import { mockConfig, mockTxRequest } from '../helpers';

describe('Scanner Unit Tests', () => {
  let config: Config;
  let txBlock: ITxRequest;

  let scanner: Scanner;

  const reset = async () => {
    const router = TypeMoq.Mock.ofType<IRouter>();
    config = await mockConfig();
    txBlock = await mockTxRequest(config.web3, true);

    scanner = new Scanner(config, router.object);
  };

  beforeEach(reset);

  it('initializes the Scanner', () => {
    scanner = new Scanner(config, null);
    expect(scanner).to.exist;
  });

  describe('start()', async () => {
    it('returns true for scanning and chainScanner/cacheScanner', async () => {
      await scanner.start();
      assert.isTrue(scanner.scanning);
      expect(scanner.cacheInterval).to.exist;
      expect(scanner.chainInterval).to.exist;
    }).timeout(5000);

    it('returns true when watching disabled', async () => {
      scanner.util.isWatchingEnabled = () => Promise.resolve(false);
      expect(scanner.start).to.throw;
    }).timeout(5000);
  });

  describe('stop()', async () => {
    it('returns false for scanning and chainScanner/cacheScanner', async () => {
      await scanner.start();
      await scanner.stop();
      assert.isNotTrue(scanner.scanning);
      assert.equal(scanner.cacheInterval[0], null);
      assert.equal(scanner.chainInterval[0], null);
    }).timeout(5000);
  });

  describe('watchRequestsByBucket()', () => {
    it('starts watchers for a new bucket', async () => {
      const bucket = (await txBlock.now()).toNumber();
      const previousBucket = bucket - BucketSize.block;

      await scanner.watchRequestsByBucket(bucket, previousBucket);

      expect(scanner.eventWatchers[bucket]).to.exist;
      expect(scanner.eventWatchers[previousBucket]).to.not.exist;
    });
  });

  describe('watchBlockchain()', () => {
    it('sets the buckets', async () => {
      await scanner.watchBlockchain();
      expect(scanner.buckets).to.haveOwnProperty('currentBuckets');
      expect(scanner.buckets).to.haveOwnProperty('nextBuckets');
    });
  });

  describe('scanCache()', () => {
    it('returns EMPTY when cache empty', async () => {
      const state = await scanner.scanCache();
      assert.equal(state, CacheStates.EMPTY);
    });

    it('returns REFRESHED when cache not empty', async () => {
      const tx = {
        claimedBy: '0x0',
        claimingFailed: false,
        wasCalled: false,
        windowStart: new BigNumber(10000)
      };
      config.cache.set('tx', tx);

      const state = await scanner.scanCache();
      assert.equal(state, CacheStates.REFRESHED);
    });
  });
});
