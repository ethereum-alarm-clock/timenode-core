/* tslint:disable:no-unused-expression */
import { expect, assert } from 'chai';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequest, mockTxStatus } from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';
import Scanner from '../../src/Scanner';
import { TxStatus } from '../../src/Enum';
import { BucketSize, IBucketPair } from '../../src/Buckets';

const TIMESTAMP_TX = 'timestamp Tx';
const BLOCK_TX = 'block Tx';

describe('Scanner Unit Tests', () => {
  let config: Config;
  let txTimestamp: any;
  let txBlock: any;

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
      expect(scanner.cacheScanner).to.exist;
      expect(scanner.chainScanner).to.exist;
    }).timeout(5000);
  });

  describe('stop()', async () => {
    it('returns false for scanning and chainScanner/cacheScanner', async () => {
      await scanner.start();
      await scanner.stop();
      assert.isNotTrue(scanner.scanning);
      assert.equal(scanner.cacheScanner[0], null);
      assert.equal(scanner.chainScanner[0], null);
    }).timeout(5000);
  });

  describe('isUpcoming()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns true when tx is before claim window', async () => {
        const tx = mockTxStatus(txTimestamp, TxStatus.BeforeClaimWindow);
        assert.isTrue(await scanner.isUpcoming(tx));
      });

      it('returns true when tx is in claim window', async () => {
        const tx = mockTxStatus(txTimestamp, TxStatus.ClaimWindow);
        assert.isTrue(await scanner.isUpcoming(tx));
      });

      it('returns true when tx is in freeze period', async () => {
        const tx = mockTxStatus(txTimestamp, TxStatus.FreezePeriod);
        assert.isTrue(await scanner.isUpcoming(tx));
      });

      it('returns true when tx is in execution window', async () => {
        const tx = mockTxStatus(txTimestamp, TxStatus.ExecutionWindow);
        assert.isTrue(await scanner.isUpcoming(tx));
      });

      it('returns false when tx is past execution window', async () => {
        const tx = mockTxStatus(txTimestamp, TxStatus.Executed);
        assert.isFalse(await scanner.isUpcoming(tx));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns true when tx is before claim window', async () => {
        const tx = mockTxStatus(txBlock, TxStatus.BeforeClaimWindow);
        assert.isTrue(await scanner.isUpcoming(tx));
      });

      it('returns true when tx is in claim window', async () => {
        const tx = mockTxStatus(txBlock, TxStatus.ClaimWindow);
        assert.isTrue(await scanner.isUpcoming(tx));
      });

      it('returns true when tx is in freeze period', async () => {
        const tx = mockTxStatus(txBlock, TxStatus.FreezePeriod);
        assert.isTrue(await scanner.isUpcoming(tx));
      });

      it('returns true when tx is in execution window', async () => {
        const tx = mockTxStatus(txBlock, TxStatus.ExecutionWindow);
        assert.isTrue(await scanner.isUpcoming(tx));
      });

      it('returns false when tx is past execution window', async () => {
        const tx = mockTxStatus(txBlock, TxStatus.Executed);
        assert.isFalse(await scanner.isUpcoming(tx));
      });
    });
  });

  describe('getCurrentBuckets()', () => {
    it('returns the current buckets', async () => {
      const block = {
        number: txBlock.now().toNumber(),
        timestamp: txTimestamp.now().toNumber()
      };

      const { blockBucket, timestampBucket } = await scanner.getCurrentBuckets(block);

      assert.equal(blockBucket, -1 * (block.number - (block.number % BucketSize.block)));
      assert.equal(timestampBucket, block.timestamp - (block.timestamp % BucketSize.timestamp));
    });
  });

  describe('getNextBuckets()', async () => {
    it('returns next buckets', async () => {
      const block = {
        number: txBlock.now().toNumber(),
        timestamp: txTimestamp.now().toNumber()
      };

      const { blockBucket, timestampBucket } = await scanner.getNextBuckets(block);

      const expectedBlockInterval = block.number + BucketSize.block;
      const expectedTimestampInterval = block.timestamp + BucketSize.timestamp;

      assert.equal(
        blockBucket,
        -1 * (expectedBlockInterval - (expectedBlockInterval % BucketSize.block))
      );
      assert.equal(
        timestampBucket,
        expectedTimestampInterval - (expectedTimestampInterval % BucketSize.timestamp)
      );
    });
  });

  describe('getBuckets()', () => {
    it('returns current and next buckets', async () => {
      const { currentBuckets, nextBuckets } = await scanner.getBuckets();

      expect(currentBuckets).to.haveOwnProperty('blockBucket');
      expect(currentBuckets).to.haveOwnProperty('timestampBucket');
      expect(nextBuckets).to.haveOwnProperty('blockBucket');
      expect(nextBuckets).to.haveOwnProperty('timestampBucket');
    });
  });

  describe('handleRequest()', () => {
    it('stores request into cache if discovered', () => {
      scanner.handleRequest(txTimestamp);
      expect(scanner.config.cache.get(txTimestamp.address)).to.exist;
      assert.equal(
        scanner.config.cache.get(txTimestamp.address).windowStart,
        txTimestamp.params[7]
      );
    });

    it('rejects request if invalid address', () => {
      const address = txTimestamp.address.substring(0, 3);
      txTimestamp.address = address;
      expect(() => scanner.handleRequest(txTimestamp)).to.throw();
    });
  });

  describe('stopWatcher()', () => {
    it('clears the watcher', async () => {
      const block = txBlock.now().toNumber();
      await scanner.stopWatcher(block);
      expect(scanner.eventWatchers[block]).to.not.exist;
    });
  });

  describe('stopWatcher()', () => {
    it('clears the watcher', async () => {
      const bucket = txBlock.now().toNumber();
      await scanner.stopWatcher(bucket);
      expect(scanner.eventWatchers[bucket]).to.not.exist;
    });
  });

  describe('watchRequestsByBucket()', () => {
    it('starts watchers for a new bucket', async () => {
      const bucket = txBlock.now().toNumber();
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

  describe('isValid()', () => {
    it('returns true when correct address format', () => {
      assert.isTrue(scanner.isValid(txBlock.address));
    });

    it('errors when an invalid address', () => {
      expect(() => scanner.isValid(txBlock.address.substring(0, 5))).to.throw();
    });

    it('returns false when null address', () => {
      assert.isFalse(scanner.isValid(scanner.config.eac.Constants.NULL_ADDRESS));
    });
  });

  describe('isValid()', () => {
    it('returns true when correct address format', () => {
      assert.isTrue(scanner.isValid(txBlock.address));
    });

    it('errors when an invalid address', () => {
      expect(() => scanner.isValid(txBlock.address.substring(0, 5))).to.throw();
    });

    it('returns false when null address', () => {
      assert.isFalse(scanner.isValid(scanner.config.eac.Constants.NULL_ADDRESS));
    });
  });

  describe('store()', () => {
    it('returns true when correct address format', () => {
      scanner.store(txTimestamp);
      expect(config.cache.get(txTimestamp.address)).to.exist;
    });
  });

  describe('scanCache()', () => {
    // TO-DO when we have meaningful data returns
  });
});
