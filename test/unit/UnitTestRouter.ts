import { expect, assert } from 'chai';
import BigNumber from 'bignumber.js';
import * as moment from 'moment';

import { Config } from '../../src/index';
import { mockConfig, MockTxRequest } from '../helpers';
import Actions from '../../src/Actions';
import Router from '../../src/Router';
import { TxStatus } from '../../src/Enum';

const TIMESTAMP_TX = 'timestamp Tx';
const BLOCK_TX = 'block Tx';

describe('Router Unit Tests', () => {
  let config: Config;
  let txTimestamp: any;
  let txBlock: any;

  let router: Router;
  let actions: Actions;
  let myAccount: string;

  const reset = async () => {
    config = mockConfig();
    txTimestamp = await MockTxRequest(config.web3);
    txBlock = await MockTxRequest(config.web3, true);

    actions = new Actions(config);
    router = new Router(config, actions);
    myAccount = router.config.wallet.getAddresses()[0];
  };

  beforeEach(reset);

  it('initializes the Router', async () => {
    actions = new Actions(config);
    router = new Router(config, actions);
    expect(router).to.exist;
  });

  describe('isTransactionMissed()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns false when scheduled for future', async () => {
        assert.isNotTrue(await router.isTransactionMissed(txTimestamp));
      });

      it('returns true when scheduled execution window passed', async () => {
        txTimestamp.windowStart = new BigNumber(
          moment()
            .subtract(1, 'week')
            .unix()
        );
        assert.isTrue(await router.isTransactionMissed(txTimestamp));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns false when scheduled for future', async () => {
        assert.isNotTrue(await router.isTransactionMissed(txBlock));
      });

      it('returns true when scheduled execution window passed', async () => {
        txBlock.windowStart = txBlock.currentBlockNumber.minus(txBlock.windowSize.plus(10));
        assert.isTrue(await router.isTransactionMissed(txBlock));
      });
    });
  });

  describe('isLocalClaim()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns false when different address', async () => {
        assert.isNotTrue(await router.isLocalClaim(txTimestamp));
      });

      it('returns true when same address', async () => {
        txTimestamp.claimedBy = myAccount;
        assert.isTrue(await router.isLocalClaim(txTimestamp));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns false when different address', async () => {
        assert.isNotTrue(await router.isLocalClaim(txBlock));
      });

      it('returns true when same address', async () => {
        txBlock.claimedBy = myAccount;
        assert.isTrue(await router.isLocalClaim(txBlock));
      });
    });
  });

  describe('beforeClaimWindow()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns BeforeClaimWindow when claim window not started', async () => {
        assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow when claim window started', async () => {
        txTimestamp.claimWindowStart = new BigNumber(
          moment()
            .subtract(1, 'hour')
            .unix()
        );
        assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.ClaimWindow);
      });

      it('returns Executed when tx cancelled', async () => {
        txTimestamp.isCancelled = true;
        assert.equal(await router.beforeClaimWindow(txTimestamp), TxStatus.Executed);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns BeforeClaimWindow when claim window not started', async () => {
        assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow when claim window started', async () => {
        txBlock.claimWindowStart = new BigNumber(0);
        assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.ClaimWindow);
      });

      it('returns Executed when tx cancelled', async () => {
        txBlock.isCancelled = true;
        assert.equal(await router.beforeClaimWindow(txBlock), TxStatus.Executed);
      });
    });
  });

  describe('claimWindow()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns FreezePeriod when claim window not started', async () => {
        assert.equal(await router.claimWindow(txTimestamp), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow when claim window started', async () => {
        txTimestamp.claimWindowStart = new BigNumber(
          moment()
            .subtract(1, 'hour')
            .unix()
        );
        assert.equal(await router.claimWindow(txTimestamp), TxStatus.ClaimWindow);
      });

      it('returns FreezePeriod when tx is already claimed', async () => {
        txBlock.txTimestamp = true;
        assert.equal(await router.claimWindow(txTimestamp), TxStatus.FreezePeriod);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns FreezePeriod when claim window not started', async () => {
        assert.equal(await router.claimWindow(txBlock), TxStatus.FreezePeriod);
      });

      it('returns ClaimWindow when claim window started', async () => {
        txBlock.claimWindowStart = new BigNumber(0);
        assert.equal(await router.claimWindow(txBlock), TxStatus.ClaimWindow);
      });

      it('returns FreezePeriod when tx is already claimed', async () => {
        txBlock.isClaimed = true;
        assert.equal(await router.claimWindow(txBlock), TxStatus.FreezePeriod);
      });
    });
  });

  describe('freezePeriod()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns freezePeriod when in freeze', async () => {
        txTimestamp.claimWindowStart = txTimestamp.claimWindowStart.minus(txTimestamp.freezePeriod);
        assert.equal(await router.freezePeriod(txTimestamp), TxStatus.FreezePeriod);
      });

      it('returns ExecutionWindow when in execution window', async () => {
        txTimestamp.windowStart = txTimestamp.now();
        assert.equal(await router.freezePeriod(txTimestamp), TxStatus.ExecutionWindow);
      });

      it('returns FreezePeriod when execution window passed', async () => {
        txTimestamp.windowStart = new BigNumber(
          moment()
            .subtract(1, 'week')
            .unix()
        );
        assert.equal(await router.freezePeriod(txTimestamp), TxStatus.FreezePeriod);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns freezePeriod when in freeze', async () => {
        txBlock.claimWindowStart = txBlock.claimWindowStart.minus(txBlock.freezePeriod);
        assert.equal(await router.freezePeriod(txBlock), TxStatus.FreezePeriod);
      });

      it('returns ExecutionWindow when in execution window', async () => {
        txBlock.windowStart = new BigNumber(txBlock.now());
        assert.equal(await router.freezePeriod(txBlock), TxStatus.ExecutionWindow);
      });

      it('returns FreezePeriod when execution window passed', async () => {
        txBlock.windowStart = txBlock.currentBlockNumber.minus(txBlock.windowSize.plus(10));
        assert.equal(await router.freezePeriod(txBlock), TxStatus.FreezePeriod);
      });
    });
  });

  describe('inReservedWindowAndNotClaimedLocally()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns false when not in reserved window and not claimed locally', async () => {
        txTimestamp.isClaimed = true;
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txTimestamp));
      });

      it('returns true when in reserved window and not claimed locally', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.windowStart = txTimestamp.now();
        assert.isTrue(await router.inReservedWindowAndNotClaimedLocally(txTimestamp));
      });

      it('returns false when not in reserved window and claimed locally', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.claimedBy = myAccount;
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txTimestamp));
      });

      it('returns false when in reserved window and claimed locally', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.claimedBy = myAccount;
        txTimestamp.windowStart = txTimestamp.now();
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txTimestamp));
      });
    });

    describe(BLOCK_TX, () => {
      it('returns false when not in reserved window and not claimed locally', async () => {
        txBlock.isClaimed = true;
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txBlock));
      });

      it('returns true when in reserved window and not claimed locally', async () => {
        txBlock.isClaimed = true;
        txBlock.windowStart = txBlock.now();
        assert.isTrue(await router.inReservedWindowAndNotClaimedLocally(txBlock));
      });

      it('returns false when not in reserved window and claimed locally', async () => {
        txBlock.isClaimed = true;
        txBlock.claimedBy = myAccount;
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txBlock));
      });

      it('returns false when in reserved window and claimed locally', async () => {
        txBlock.isClaimed = true;
        txBlock.claimedBy = myAccount;
        txBlock.windowStart = txTimestamp.now();
        assert.isFalse(await router.inReservedWindowAndNotClaimedLocally(txBlock));
      });
    });
  });

  describe('executionWindow()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns Executed when execution was called', async () => {
        txTimestamp.wasCalled = true;
        assert.equal(await router.executionWindow(txTimestamp), TxStatus.Executed);
      });

      it('returns Missed when tx execution was missed', async () => {
        txTimestamp.windowStart = new BigNumber(
          moment()
            .subtract(1, 'week')
            .unix()
        );
        assert.equal(await router.executionWindow(txTimestamp), TxStatus.Missed);
      });

      it('returns ExecutionWindow if inReservedWindowAndNotClaimedLocally', async () => {
        txTimestamp.isClaimed = true;
        txTimestamp.windowStart = txTimestamp.now();
        assert.equal(await router.executionWindow(txTimestamp), TxStatus.ExecutionWindow);
      });

      // it('returns Executed when executes transaction', async () => {
      //   assert.equal(await router.executionWindow(txTimestamp), TxStatus.Executed);
      // });
    });

    describe(BLOCK_TX, () => {
      it('returns Executed when execution was called', async () => {
        txBlock.wasCalled = true;
        assert.equal(await router.executionWindow(txBlock), TxStatus.Executed);
      });

      it('returns Missed when tx execution was missed', async () => {
        txBlock.windowStart = txBlock.currentBlockNumber.minus(txBlock.windowSize.plus(10));
        assert.equal(await router.executionWindow(txBlock), TxStatus.Missed);
      });

      it('returns ExecutionWindow if inReservedWindowAndNotClaimedLocally', async () => {
        txBlock.isClaimed = true;
        txBlock.windowStart = txBlock.now();
        assert.equal(await router.executionWindow(txBlock), TxStatus.ExecutionWindow);
      });

      // it('returns Executed when executes transaction', async () => {
      //   assert.equal(await router.executionWindow(txBlock), TxStatus.Executed);
      // });
    });
  });

  describe('route()', () => {
    describe(TIMESTAMP_TX, () => {
      it('returns BeforeClaimWindow status', async () => {
        assert.equal(await router.route(txTimestamp), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow status', async () => {
        txTimestamp.claimWindowStart = new BigNumber(
          moment()
            .subtract(1, 'hour')
            .unix()
        );
        assert.equal(await router.route(txTimestamp), TxStatus.ClaimWindow);
      });
    });

    describe(BLOCK_TX, () => {
      it('returns BeforeClaimWindow status', async () => {
        assert.equal(await router.route(txBlock), TxStatus.BeforeClaimWindow);
      });

      it('returns ClaimWindow status', async () => {
        txBlock.claimWindowStart = new BigNumber(0);
        txBlock.windowSize = new BigNumber(0);
        assert.equal(await router.route(txBlock), TxStatus.ClaimWindow);
      });
    });
  });
});
