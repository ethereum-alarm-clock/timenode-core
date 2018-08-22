/* tslint:disable:no-unused-expression */
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

const TIMESTAMP_TX = 'timestamp Tx';
const BLOCK_TX = 'block Tx';

describe('Scanner Unit Tests', () => {
  let config: Config;
  let txTimestamp: ITxRequest;
  let txBlock: ITxRequest;

  let router: Router;
  let actions: Actions;
  let scanner: Scanner;

  const reset = async () => {
    config = mockConfig();
    txTimestamp = await MockTxRequest(config.web3);
    txBlock = await MockTxRequest(config.web3, true);

    actions = new Actions(config);
    router = new Router(config, actions);
    scanner = new Scanner(config, router);
  };

  beforeEach(reset);

  it('initializes the Scanner', () => {
    actions = new Actions(config);
    router = new Router(config, actions);
    scanner = new Scanner(config, router);
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

  // describe('handleRequest()', () => {
  //   it('stores request into cache if discovered', () => {
  //     const params = [].fill(new BigNumber(10), 0, 12);
  //     const address = txTimestamp.address;

  //     scanner.handleRequest({ address, params });
  //     expect(scanner.config.cache.get(txTimestamp.address)).to.exist;
  //     assert.equal(scanner.config.cache.get(txTimestamp.address).windowStart, params[7]);
  //   });

  //   it('rejects request if invalid address', () => {
  //     const address = txTimestamp.address.substring(0, 3);
  //     const params = [].fill(new BigNumber(10), 0, 12);

  //     expect(() => scanner.handleRequest({ address, params })).to.throw();
  //   });
  // });

  // describe('stopWatcher()', () => {
  //   it('clears the watcher', async () => {
  //     const block = (await txBlock.now()).toNumber();
  //     await scanner.stopWatcher(block);
  //     expect(scanner.eventWatchers[block]).to.not.exist;
  //   });
  // });

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

  // describe('isValid()', () => {
  //   it('returns true when correct address format', () => {
  //     assert.isTrue(scanner.isValid(txBlock.address));
  //   });

  //   it('errors when an invalid address', () => {
  //     expect(() => scanner.isValid(txBlock.address.substring(0, 5))).to.throw();
  //   });

  //   it('returns false when null address', () => {
  //     assert.isFalse(scanner.isValid(scanner.config.eac.Constants.NULL_ADDRESS));
  //   });
  // });

  // describe('store()', () => {
  //   it('returns true when correct address format', () => {
  //     const params = [].fill(new BigNumber(10), 0, 12);
  //     scanner.store({ address: txTimestamp.address, params });
  //     expect(config.cache.get(txTimestamp.address)).to.exist;
  //   });
  // });

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
