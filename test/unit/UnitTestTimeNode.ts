import { expect, assert } from 'chai';
import { TimeNode, Config } from '../../src/index';
import { mockConfig } from '../helpers';
import { BigNumber } from 'bignumber.js';

describe('TimeNode Unit Tests', () => {
  let config: Config;
  let myAccount: string;
  let timenode: TimeNode;
  const emitEvents = {
    emitClose: (self: any) => {
      self.emit('close');
    },
    emitEnd: (self: any) => {
      self.connection._client.emit('connectFailed');
    },
    emitError: (self: any) => {
      //Trigger connecion failed event
      self.connection._client.emit('connectFailed');
    }
  };

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
        claimingFailed: false,
        wasCalled: false,
        windowStart: new BigNumber(10000)
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

  describe('handleDisconnections', () => {
    it('detects Error  Disconnect', async () => {
      const newconfig = await mockConfig();
      const runningNode = new TimeNode(newconfig);
      let triggered: boolean;
      await runningNode.startScanning();
      assert.isTrue(runningNode.scanner.scanning);
      Object.assign(runningNode, {
        handleWsDisconnect: () => {
          triggered = true;
          runningNode.stopScanning();
        }
      });
      emitEvents.emitError(runningNode.config.web3.currentProvider);
      setTimeout(() => {
        assert.isTrue(triggered, 'Disconnect not detected');
      }, 7000);
    });

    it('detects End  Disconnect', async () => {
      const newconfig = await mockConfig();
      const runningNode = new TimeNode(newconfig);
      let triggered: boolean;
      await runningNode.startScanning();
      assert.isTrue(runningNode.scanner.scanning);
      Object.assign(runningNode, {
        handleWsDisconnect: () => {
          triggered = true;
          runningNode.stopScanning();
        }
      });
      emitEvents.emitEnd(runningNode.config.web3.currentProvider);
      setTimeout(() => {
        assert.isTrue(triggered, 'Disconnect not detected');
      }, 7000);
    });

    it('does not restart connection on stop Timenode', async () => {
      const newconfig = await mockConfig();
      const runningNode = new TimeNode(newconfig);
      let triggered: boolean;
      await runningNode.startScanning();
      assert.isTrue(runningNode.scanner.scanning);
      Object.assign(runningNode, {
        wsReconnect: () => {
          triggered = true;
        }
      });
      runningNode.stopScanning();
      assert.isUndefined(triggered, 'Invalid Disconnect detected');
    });
  });
});
