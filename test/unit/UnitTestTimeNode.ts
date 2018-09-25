import { expect, assert } from 'chai';
import { TimeNode, Config } from '../../src/index';
import { mockConfig } from '../helpers';
import { BigNumber } from 'bignumber.js';
import { TxStatus } from '../../src/Enum';

describe('TimeNode Unit Tests', () => {
  let config: Config;
  let myAccount: string;
  let timenode: TimeNode;

  before(async () => {
    config = await mockConfig();
    myAccount = config.wallet.getAddresses()[0];
    timenode = new TimeNode(config);
  });

  it('initializes a basic timenode', () => {
    expect(timenode).to.exist; // tslint:disable-line no-unused-expression
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

      timenode.config.web3.version.getNetwork = (callback: (err: any, res: any) => void) => {
        callback(null, true);
      };

      timenode.logNetwork();
      assert.isTrue(networkLogged);
    });
  });

  describe('getClaimedNotExecutedTransactions()', () => {
    it('returns 0 when no transactions', () => {
      const txs = timenode.getClaimedNotExecutedTransactions()[myAccount];
      assert.equal(txs.length, 0);
    });

    it('returns a transaction', () => {
      const tx = {
        claimedBy: config.wallet.getAddresses()[0],
        wasCalled: false,
        windowStart: new BigNumber(10000),
        status: TxStatus.FreezePeriod
      };
      config.cache.set('tx', tx);

      const txs = timenode.getClaimedNotExecutedTransactions()[myAccount];
      assert.equal(txs.length, 1);
    });
  });

  describe('getUnsucessfullyClaimedTransactions()', () => {
    it('returns empty array when no failed claims', () => {
      const txs = timenode.getUnsucessfullyClaimedTransactions()[myAccount];
      assert.equal(txs.length, 0);
    });

    it('returns failed claims when they are present', () => {
      const failedClaimAddress = '0xe87529a6123a74320e13a6dabf3606630683c029';

      config.statsDb.claimed(
        config.wallet.getAddresses()[0],
        failedClaimAddress,
        new BigNumber(0),
        false
      );

      const txs = timenode.getUnsucessfullyClaimedTransactions()[myAccount];
      assert.equal(txs.length, 1);

      assert.deepEqual(txs, ['0xe87529a6123a74320e13a6dabf3606630683c029']);
    });
  });
});
