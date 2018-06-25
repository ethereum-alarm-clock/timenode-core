import { expect, assert } from 'chai';
import BigNumber from 'bignumber.js';
import * as moment from 'moment';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequest } from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';
import Scanner from '../../src/Scanner';

const TIMESTAMP_TX = 'timestamp Tx';
const BLOCK_TX = 'block Tx';

describe('Scanner Unit Tests', () => {
  let config: Config;
  let txTimestamp: any;
  let txBlock: any;

  let router: Router;
  let actions: Actions;
  let scanner: Scanner;
  let myAccount: string;

  const reset = async () => {
    config = mockConfig();
    txTimestamp = await MockTxRequest(config.web3);
    txBlock = await MockTxRequest(config.web3, true);

    actions = new Actions(config);
    router = new Router(config, actions);
    scanner = new Scanner(config, router);
    myAccount = router.config.wallet.getAddresses()[0];
  };

  beforeEach(reset);

  it('initializes the Scanner', async () => {
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
    });
  });

  describe('stop()', async () => {
    it('returns false for scanning and chainScanner/cacheScanner', async () => {
      await scanner.start();
      await scanner.stop();
      assert.isNotTrue(scanner.scanning);
      assert.equal(scanner.cacheScanner[0], null);
      assert.equal(scanner.chainScanner[0], null);
    });
  });

  describe('isUpcoming()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns true when tx is before claim window', async () => {
        assert.isTrue(await scanner.isUpcoming(txTimestamp));
      });

      it('returns true when tx is in claim window', async () => {
        txTimestamp.claimWindowStart = new BigNumber(
          moment()
            .subtract(1, 'hour')
            .unix()
        );
        assert.isTrue(await scanner.isUpcoming(txTimestamp));
      });

      it('returns true when tx is in freeze period', async () => {
        txTimestamp.claimWindowStart = txTimestamp.claimWindowStart.minus(txTimestamp.freezePeriod);
        assert.isTrue(await scanner.isUpcoming(txTimestamp));
      });

      it('returns true when tx is in execution window', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.windowStart = txTimestamp.now();
        assert.isTrue(await scanner.isUpcoming(txTimestamp));
      });

      it('returns false when tx is past execution window', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.wasCalled = true;
        txTimestamp.claimWindowStart = new BigNumber(
          moment()
            .subtract(1, 'week')
            .unix()
        );
        txTimestamp.windowStart = new BigNumber(
          moment()
            .subtract(1, 'week')
            .unix()
        );
        assert.isFalse(await scanner.isUpcoming(txTimestamp));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns true when tx is before claim window', async () => {
        assert.isTrue(await scanner.isUpcoming(txBlock));
      });

      it('returns true when tx is in claim window', async () => {
        txBlock.claimWindowStart = new BigNumber(0);
        assert.isTrue(await scanner.isUpcoming(txBlock));
      });

      it('returns true when tx is in freeze period', async () => {
        txBlock.claimWindowStart = txBlock.claimWindowStart.minus(txBlock.freezePeriod);
        assert.isTrue(await scanner.isUpcoming(txBlock));
      });

      it('returns true when tx is in execution window', async () => {
        txBlock.isClaimed = true;
        txBlock.windowStart = txBlock.now();
        assert.isTrue(await scanner.isUpcoming(txBlock));
      });

      it('returns false when tx is past execution window', async () => {
        txBlock.isClaimed = true;
        txBlock.wasCalled = true;
        txBlock.claimWindowStart = new BigNumber(0);
        txBlock.windowStart = new BigNumber(0);
        txBlock.windowSize = new BigNumber(0);
        assert.isFalse(await scanner.isUpcoming(txBlock));
      });
    });
  });
});
