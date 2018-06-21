import { expect, assert } from 'chai';
import BigNumber from 'bignumber.js';
import * as moment from 'moment';

import { Config } from '../../src/index';
import {
  mockConfig,
  MockTxRequest
} from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';
import { TxStatus } from '../../src/Enum';

describe('Router Unit Tests', () => {
  let config: Config;
  let txTimestamp: any;
  let txBlock: any;
  
  const reset = async () => {
    config = mockConfig();
    txTimestamp = await MockTxRequest(config.web3);
    txBlock = await MockTxRequest(config.web3, true);

    actions = new Actions(config);
    router = new Router(config, actions);
  };
  
  let router: Router;
  let actions: Actions;

  beforeEach(reset);
  
  it('initializes the Router', async () => {
    actions = new Actions(config);
    router = new Router(config, actions);
    expect(router).to.exist;
  });

  describe('isTransactionMissed()', () => {
    describe('timestamp Tx', () => {
      it('returns false when scheduled for future', async () => {
        assert.isNotTrue(await router.isTransactionMissed(txTimestamp));
      });
    
      it('returns true when scheduled executionWindowEnd passed', async () => {
        txTimestamp.executionWindowEnd = new BigNumber(moment().subtract(1, 'week').unix());
        assert.isTrue(await router.isTransactionMissed(txTimestamp));
      });
    });

    describe('block Tx', () => {
      it('returns false when scheduled for future', async () => {
        assert.isNotTrue(await router.isTransactionMissed(txBlock));
      });

      it('returns true when scheduled executionWindowEnd passed', async () => {
        txBlock.executionWindowEnd = new BigNumber(10);
        assert.isTrue(await router.isTransactionMissed(txBlock));
      });
    });
  });

  describe('isLocalClaim()', () => {
    describe('timestamp Tx', () => {
      it('returns false when different address', async () => {
        assert.isNotTrue(await router.isLocalClaim(txTimestamp));
      });

      it('returns true when same address', async () => {
        let myAccount = router.config.wallet.getAddresses()[0];
        txTimestamp.claimedBy = myAccount;
        assert.isTrue(await router.isLocalClaim(txTimestamp));
      });
    });

    describe('block Tx', () => {
      it('returns false when different address', async () => {
        assert.isNotTrue(await router.isLocalClaim(txBlock));
      });

      it('returns true when same address', async () => {
        let myAccount = router.config.wallet.getAddresses()[0];
        txBlock.claimedBy = myAccount;
        assert.isTrue(await router.isLocalClaim(txBlock));
      });
    });
  });

  describe('beforeClaimWindow()', () => {
    describe('timestamp Tx', () => {
      it('returns BeforeClaimWindow when claim window not started', async () => {
        assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow when claim window started', async () => {
        txTimestamp.claimWindowStart = new BigNumber(moment().subtract(1, 'hour').unix());
        assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.ClaimWindow);
      });

      it('returns Executed when tx cancelled', async () => {
        txTimestamp.isCancelled = true;
        assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.Executed);
      });
    });

    describe('block Tx', () => {
      it('returns BeforeClaimWindow when claim window not started', async () => {
        assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow when claim window started', async () => {
        txBlock.claimWindowStart = new BigNumber(10);
        assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.ClaimWindow);
      });

      it('returns Executed when tx cancelled', async () => {
        txBlock.isCancelled = true;
        assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.Executed);
      });
    });
  });

  describe('claimWindow()', () => {
    describe('timestamp Tx', () => {
      it('returns FreezePeriod when claim window not started', async () => {
        assert.equal(await router.claimWindow(txTimestamp), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow when claim window started', async () => {
        txTimestamp.claimWindowStart = new BigNumber(moment().subtract(1, 'hour').unix());
        assert.equal(await router.claimWindow(txTimestamp), TxStatus.ClaimWindow);
      });

      it('returns FreezePeriod when tx is already claimed', async () => {
        txBlock.txTimestamp = true;
        assert.equal(await router.claimWindow(txTimestamp), TxStatus.FreezePeriod);
      });
    });

    describe('block Tx', () => {
      it('returns FreezePeriod when claim window not started', async () => {
        assert.equal(await router.claimWindow(txBlock), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow when claim window started', async () => {
        txBlock.claimWindowStart = new BigNumber(10);
        assert.equal(await router.claimWindow(txBlock), TxStatus.ClaimWindow);
      });

      it('returns FreezePeriod when tx is already claimed', async () => {
        txBlock.isClaimed = true;
        assert.equal(await router.claimWindow(txBlock), TxStatus.FreezePeriod);
      });
    });
  });

  describe('freezePeriod()', () => {
    describe('timestamp Tx', () => {
      it('returns freezePeriod when in freeze', async () => {
        txTimestamp.claimWindowStart = txTimestamp.claimWindowStart.minus(txTimestamp.freezePeriod);
        assert.equal(await router.freezePeriod(txTimestamp), TxStatus.FreezePeriod);
      });

      it('returns ExecutionWindow when in execution window', async () => {
        txTimestamp.windowStart = new BigNumber(txTimestamp.now());
        assert.equal(await router.freezePeriod(txTimestamp), TxStatus.ExecutionWindow);
      });

      it('returns FreezePeriod when execution window passed', async () => {
        txTimestamp.executionWindowEnd = new BigNumber(moment().subtract(1, 'day').unix());
        assert.equal(await router.freezePeriod(txTimestamp), TxStatus.FreezePeriod);
      });
    });

    describe('block Tx', () => {
      it('returns freezePeriod when in freeze', async () => {
        txBlock.claimWindowStart = txBlock.claimWindowStart.minus(txBlock.freezePeriod);
        assert.equal(await router.freezePeriod(txBlock), TxStatus.FreezePeriod);
      });

      it('returns ExecutionWindow when in execution window', async () => {
        txBlock.windowStart = new BigNumber(txBlock.now());
        assert.equal(await router.freezePeriod(txBlock), TxStatus.ExecutionWindow);
      });

      it('returns FreezePeriod when execution window passed', async () => {
        txBlock.executionWindowEnd = txBlock.currentBlockNumber.minus(100);
        assert.equal(await router.freezePeriod(txBlock), TxStatus.FreezePeriod);
      });
    });
  });

  describe('route()', () => {
    it('route()', async () => {
      // assert.isTrue(await router.route(txBlock));
      // assert.isTrue(await router.route(txTimestamp));
    });
  });

});
