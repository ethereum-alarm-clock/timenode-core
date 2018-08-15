import { expect, assert } from 'chai';
import { TimeNode, Config } from '../../src/index';
import { mockConfig } from '../helpers';
import { BigNumber } from 'bignumber.js';

describe('TimeNode Unit Tests', () => {
  const config: Config = mockConfig();
  let timenode: TimeNode;

  it('initializes a basic timenode', () => {
    timenode = new TimeNode(config);
    expect(timenode).to.exist;
  });

  describe('startScanning()', () => {
    it('returns true when started scanning', async () => {
      assert.isTrue(await timenode.startScanning());
      assert.isTrue(timenode.scanner.scanning);
    }).timeout(5000);

    it('hard resets the scanner module when already scanning', async () => {
      timenode.scanner.scanning = true;
      assert.isTrue(await timenode.startScanning());
      assert.isTrue(timenode.scanner.scanning);
    }).timeout(5000);
  });

  describe('startClaiming()', () => {
    it('returns false when stopped scanning', async () => {
      assert.isFalse(await timenode.stopScanning());
    }).timeout(5000);
  });

  describe('startClaiming()', () => {
    it('returns true when started claiming', () => {
      assert.isTrue(timenode.startClaiming());
      assert.isTrue(timenode.config.claiming);
    });
  });

  describe('stopClaiming()', () => {
    it('returns false when stopped claiming', () => {
      assert.isFalse(timenode.stopClaiming());
      assert.isFalse(timenode.config.claiming);
    });
  });

  describe('logNetwork()', () => {
    it('logs the network id', () => {
      let networkLogged = false;

      timenode.config.logger.info = () => {
        networkLogged = true;
      };

      timenode.config.web3.version.getNetwork = (callback: Function) => {
        callback(null, true);
      };

      timenode.logNetwork();
      assert.isTrue(networkLogged);
    });
  });

  describe('getClaimedNotExecutedTransactions()', () => {
    it('returns 0 when no transactions', () => {
      const txs = timenode.getClaimedNotExecutedTransactions();
      assert.equal(txs.length, 0);
    });

    it('returns a transaction', () => {
      const tx = {
        claimedBy: config.wallet.getAddresses()[0],
        claimingFailed: false,
        wasCalled: false,
        windowStart: new BigNumber(10000)
      };
      config.cache.set('tx', tx);

      const txs = timenode.getClaimedNotExecutedTransactions();
      assert.equal(txs.length, 1);
    });
  });

  describe('getUnsucessfullyClaimedTransactions()', () => {
    it('returns empty array when no failed claims', () => {
      const txs = timenode.getUnsucessfullyClaimedTransactions();
      assert.equal(txs.length, 0);
    });

    it('returns failed claims when they are present', () => {
      const failedClaimAddress = '0xe87529a6123a74320e13a6dabf3606630683c029';

      config.statsDb.addFailedClaim(config.wallet.getAddresses()[0], failedClaimAddress);

      const txs = timenode.getUnsucessfullyClaimedTransactions();
      assert.equal(txs.length, 1);

      assert.deepEqual(txs, ['0xe87529a6123a74320e13a6dabf3606630683c029']);
    });
  });
});
