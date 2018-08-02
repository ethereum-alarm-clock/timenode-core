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

      timenode.config.logger.info = (msg: string) => {
        networkLogged = true;
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
        wasCalled: false,
        windowStart: new BigNumber(10000)
      };
      config.cache.set('tx', tx);

      const txs = timenode.getClaimedNotExecutedTransactions();
      assert.equal(txs.length, 1);
    });
  });
});
